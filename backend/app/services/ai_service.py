import logging
import json
import re
import time
import httpx
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from fastapi import HTTPException
from app.config import settings
from app.services.customer_service import CustomerService
from app.services.appointment_service import AppointmentService
from app.schemas.customer import CustomerCreate
from app.schemas.appointment import AppointmentCreate, AppointmentUpdate

logger = logging.getLogger("uvicorn.error")

# Session state memory per conversation_id
session_memory: Dict[str, List[Dict[str, str]]] = {}
session_states: Dict[str, Dict[str, Any]] = {}

# Shared HTTP connection pool for Ollama queries
_http_client: Optional[httpx.AsyncClient] = None

def get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(60.0, connect=5.0),
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=50)
        )
    return _http_client


def parse_natural_date(text: str) -> str:
    """Parse relative date expressions ('today', 'tomorrow', 'monday', etc.) into YYYY-MM-DD."""
    today = datetime.now()
    clean = text.lower().strip()

    if "today" in clean:
        return today.strftime("%Y-%m-%d")
    elif "tomorrow" in clean:
        return (today + timedelta(days=1)).strftime("%Y-%m-%d")

    weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    for idx, day_name in enumerate(weekdays):
        if day_name in clean:
            current_idx = today.weekday()
            days_ahead = idx - current_idx
            if days_ahead <= 0:
                days_ahead += 7
            return (today + timedelta(days=days_ahead)).strftime("%Y-%m-%d")

    match = re.search(r'\b20\d{2}-\d{2}-\d{2}\b', clean)
    if match:
        return match.group(0)

    return (today + timedelta(days=1)).strftime("%Y-%m-%d")


def parse_natural_time(text: str) -> str:
    """Parse time expressions ('10 AM', '2:30 PM', '14:00') into normalized time string."""
    clean = text.strip()
    match = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(am|pm)?', clean, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = match.group(2) or "00"
        period = match.group(3)

        if period:
            period = period.upper()
            if period == "PM" and hour < 12:
                hour += 12
            elif period == "AM" and hour == 12:
                hour = 0
            return f"{hour:02d}:{minute}"
        else:
            return f"{hour:02d}:{minute}"
    return "10:00"


def extract_phone(text: str) -> str:
    """Extract digits/phone string from message input."""
    digits = re.sub(r'[^\d]', '', text)
    if digits:
        return digits
    return text.strip()


def detect_intent(message: str) -> Optional[str]:
    """First-pass lightweight intent classifier to detect user intent switching."""
    clean = message.strip().lower()

    # 1. View Appointments Keywords
    view_kw = [
        "view_appointments", "show my appointments", "my appointments", "view appointments",
        "list appointments", "view my bookings", "do i have any appointments",
        "what appointments do i have", "check my appointments"
    ]
    if any(k in clean for k in view_kw):
        return "view_appointments"

    # 2. Customer Information Keywords
    cust_kw = [
        "customer_information", "show customer details", "show my profile", "customer information",
        "customer details", "my details", "find my customer information", "what are my customer details"
    ]
    if any(k in clean for k in cust_kw):
        return "customer_information"

    # 3. Cancel Appointment Keywords
    cancel_kw = [
        "cancel_appointment", "cancel my appointment", "cancel appointment", "delete appointment",
        "i want to cancel my booking", "cancel my booking"
    ]
    if any(k in clean for k in cancel_kw):
        return "cancel_appointment"

    # 4. Update / Reschedule Appointment Keywords
    update_kw = [
        "reschedule", "change my appointment", "update my appointment", "change appointment"
    ]
    if any(k in clean for k in update_kw):
        return "update_appointment"

    # 5. Book Appointment Keywords
    book_kw = [
        "book_appointment", "i want to book an appointment", "book an appointment",
        "i need an appointment", "i want an appointment", "schedule an appointment",
        "schedule appointment", "want to book", "book appointment"
    ]
    if any(k in clean for k in book_kw):
        return "book_appointment"

    # 6. Greeting Keywords
    greetings = ["hello", "hi", "hey", "good morning", "good afternoon", "greetings"]
    if clean in greetings or any(clean.startswith(g) for g in ["hello", "hi ", "hey "]):
        return "greeting"

    # 7. Ask Question Keywords
    question_kw = ["where are you located", "what services", "working hours", "business hours", "open hours"]
    if any(k in clean for k in question_kw):
        return "ask_question"

    return None


class AIService:
    """Hybrid AI Receptionist service with Customer Identity verification and State Machine isolation."""

    @staticmethod
    def get_system_prompt() -> str:
        today = datetime.now()
        date_str = today.strftime("%A, %B %d, %Y")

        return f"""You are a professional, concise AI receptionist for a business. Today: {date_str}.
Keep answers short, friendly, and helpful (under 2-3 sentences).
Do NOT output reasoning, thinking tags, or markdown codeblocks. Return valid JSON only.

Output Schema:
{{
  "thought": "brief reasoning",
  "tool_call": null,
  "tool_args": null,
  "response": "short receptionist reply",
  "intent": "greeting" | "book_appointment" | "view_appointments" | "customer_information" | "cancel_appointment" | "other"
}}"""

    @classmethod
    async def query_ollama(cls, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        """Send async request to local Ollama server using shared connection pool with thinking suppression."""
        url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/chat"

        # Pre-fill assistant message with closing think tag to suppress qwen3 thinking lag
        chat_messages = list(messages)
        if chat_messages and chat_messages[-1]["role"] != "assistant":
            chat_messages.append({"role": "assistant", "content": "<think>\n</think>"})

        payload = {
            "model": settings.OLLAMA_MODEL,
            "messages": chat_messages,
            "stream": False,
            "format": "json",
            "keep_alive": "30m",
            "options": {
                "temperature": 0.15,
                "num_predict": 128
            }
        }

        client = get_http_client()
        try:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            res_data = response.json()
            content = res_data["message"]["content"]

            cleaned_content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()
            if "```" in cleaned_content:
                match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', cleaned_content, re.DOTALL)
                if match:
                    cleaned_content = match.group(1)
                else:
                    cleaned_content = cleaned_content.replace("```json", "").replace("```", "").strip()

            start_idx = cleaned_content.find("{")
            end_idx = cleaned_content.rfind("}")
            if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                cleaned_content = cleaned_content[start_idx:end_idx+1]

            return json.loads(cleaned_content)
        except httpx.HTTPError as he:
            logger.exception("Ollama connection error occurred:")
            raise HTTPException(status_code=503, detail=f"Local AI engine is unavailable: {type(he).__name__} - {str(he)}")
        except Exception as e:
            logger.error(f"Failed to parse response from Qwen model: {str(e)}")
            return {
                "thought": "Fallback response",
                "tool_call": None,
                "tool_args": None,
                "response": "Hello! How can I assist you with your appointment or customer inquiry today?",
                "intent": "greeting"
            }

    @classmethod
    def _create_empty_state(cls) -> Dict[str, Any]:
        return {
            "intent": None,
            "step": None,
            "service": None,
            "date": None,
            "time": None,
            "name": None,
            "phone": None,
            "customer_id": None,
            "active_appts": [],
            "cancel_target": None
        }

    @classmethod
    async def chat_agent(
        cls,
        message: str,
        conversation_id: Optional[str] = None,
        action: Optional[str] = None
    ) -> Dict[str, Any]:
        """Stateful AI Agent with First-Pass Intent Router & Workflow State Override."""
        t_start = time.time()
        if not conversation_id:
            conversation_id = "default_session"

        if conversation_id not in session_states:
            session_states[conversation_id] = cls._create_empty_state()

        state = session_states[conversation_id]
        msg_clean = message.strip().lower()

        # ----------------------------------------------------
        # 0. FIRST-PASS INTENT ROUTER & WORKFLOW OVERRIDE GUARD
        # ----------------------------------------------------
        detected = action if action else detect_intent(message)

        # If a new intent command is detected while in an active workflow, ABANDON OLD WORKFLOW!
        if detected and state["intent"] and detected != state["intent"]:
            logger.info(f"INFO: Intent switch detected! Abandoning '{state['intent']}' in favor of '{detected}' for conversation '{conversation_id}'")
            session_states[conversation_id] = cls._create_empty_state()
            state = session_states[conversation_id]
            action = detected

        if action or msg_clean in ["reset", "start over", "clear"]:
            logger.info(f"INFO: Quick action / reset requested: '{action or msg_clean}' for conversation '{conversation_id}'")
            session_states[conversation_id] = cls._create_empty_state()
            state = session_states[conversation_id]

            if action == "reset" or msg_clean in ["reset", "start over", "clear"]:
                t_total = time.time() - t_start
                logger.info(f"[PERFORMANCE] Intent: reset | Total: {t_total:.3f}s")
                return {
                    "response": "Conversation reset. How can I help you today?",
                    "intent": "greeting",
                    "action_performed": False
                }

        target_intent = detected or state["intent"]

        # ----------------------------------------------------
        # 1. ROUTE TO INTENT WORKFLOW HANDLERS
        # ----------------------------------------------------

        # A. GREETING INTENT
        if target_intent == "greeting" or (state["step"] is None and detected == "greeting"):
            session_states[conversation_id] = cls._create_empty_state()
            t_total = time.time() - t_start
            logger.info(f"[PERFORMANCE] Intent: greeting | Total: {t_total:.3f}s")
            return {
                "response": "Hello! I'm your AI receptionist. How can I assist you today?",
                "intent": "greeting",
                "action_performed": False
            }

        # B. VIEW APPOINTMENTS INTENT (REQUIRES PHONE IDENTIFICATION)
        if target_intent == "view_appointments":
            if state["step"] != "waiting_for_view_phone":
                session_states[conversation_id] = cls._create_empty_state()
                state = session_states[conversation_id]
                state["intent"] = "view_appointments"
                state["step"] = "waiting_for_view_phone"
                logger.info("INFO: Intent: view_appointments | Prompting for customer phone")
                return {
                    "response": "Sure. Please provide your phone number so I can find your appointments.",
                    "intent": "view_appointments",
                    "action_performed": False
                }

            # Step: waiting_for_view_phone
            phone_input = extract_phone(message)
            logger.info(f"INFO: Customer lookup by phone: '{phone_input}' for view_appointments")

            customers = await CustomerService.get_customers(0, 100)
            target_cust = next((c for c in customers if c["phone"] == phone_input or phone_input in c["phone"]), None)

            if not target_cust:
                logger.info(f"INFO: Customer not found for phone: '{phone_input}'")
                session_states[conversation_id] = cls._create_empty_state()
                return {
                    "response": f"I couldn't find a customer profile with phone number '{phone_input}'. Would you like to book an appointment or create a profile?",
                    "intent": "view_appointments",
                    "action_performed": False
                }

            cust_id = target_cust["id"]
            cust_name = target_cust["name"]
            logger.info(f"INFO: Customer found: {cust_id} ({cust_name}) | Fetching appointments")

            appts = await AppointmentService.get_appointments(0, 50, customer_id_filter=cust_id)
            session_states[conversation_id] = cls._create_empty_state()

            if not appts:
                logger.info(f"INFO: Found 0 appointments for customer: {cust_id}")
                return {
                    "response": f"I couldn't find any scheduled appointments for {cust_name} ({phone_input}).",
                    "intent": "view_appointments",
                    "action_performed": False
                }

            logger.info(f"INFO: Found {len(appts)} appointments for customer: {cust_id}")
            formatted = [f"• {a['service']}\n  Date: {a['appointment_date']}\n  Time: {a['appointment_time']}\n  Status: {a['status']}" for a in appts]
            return {
                "response": f"Here are your appointments, {cust_name}:\n\n" + "\n\n".join(formatted),
                "intent": "view_appointments",
                "action_performed": False
            }

        # C. CUSTOMER INFORMATION INTENT (REQUIRES PHONE IDENTIFICATION)
        if target_intent == "customer_information":
            if state["step"] != "waiting_for_info_phone":
                session_states[conversation_id] = cls._create_empty_state()
                state = session_states[conversation_id]
                state["intent"] = "customer_information"
                state["step"] = "waiting_for_info_phone"
                logger.info("INFO: Intent: customer_information | Prompting for customer phone")
                return {
                    "response": "Sure. Please provide your phone number so I can find your customer details.",
                    "intent": "customer_information",
                    "action_performed": False
                }

            # Step: waiting_for_info_phone
            phone_input = extract_phone(message)
            logger.info(f"INFO: Customer lookup by phone: '{phone_input}' for customer_information")

            customers = await CustomerService.get_customers(0, 100)
            target_cust = next((c for c in customers if c["phone"] == phone_input or phone_input in c["phone"]), None)

            session_states[conversation_id] = cls._create_empty_state()

            if not target_cust:
                logger.info(f"INFO: Customer not found for phone: '{phone_input}'")
                return {
                    "response": f"I couldn't find a registered customer record under phone number '{phone_input}'.",
                    "intent": "customer_information",
                    "action_performed": False
                }

            logger.info(f"INFO: Customer found: {target_cust['id']} | Returning customer information")
            resp_str = (
                f"Here are your customer details:\n\n"
                f"Name: {target_cust['name']}\n"
                f"Phone: {target_cust['phone']}\n"
                f"Email: {target_cust.get('email') or 'N/A'}\n"
                f"Profile ID: {target_cust['id']}"
            )
            return {
                "response": resp_str,
                "intent": "customer_information",
                "action_performed": False
            }

        # D. CANCEL APPOINTMENT INTENT (REQUIRES PHONE IDENTIFICATION & CONFIRMATION)
        if target_intent == "cancel_appointment":
            if state["step"] not in ["waiting_for_cancel_phone", "waiting_for_cancel_selection", "waiting_for_cancel_confirm"]:
                session_states[conversation_id] = cls._create_empty_state()
                state = session_states[conversation_id]
                state["intent"] = "cancel_appointment"
                state["step"] = "waiting_for_cancel_phone"
                logger.info("INFO: Intent: cancel_appointment | Prompting for customer phone")
                return {
                    "response": "Sure, I can help you cancel an appointment. Please provide your phone number.",
                    "intent": "cancel_appointment",
                    "action_performed": False
                }

            if state["step"] == "waiting_for_cancel_phone":
                phone_input = extract_phone(message)
                logger.info(f"INFO: Customer lookup by phone: '{phone_input}' for cancel_appointment")

                customers = await CustomerService.get_customers(0, 100)
                target_cust = next((c for c in customers if c["phone"] == phone_input or phone_input in c["phone"]), None)

                if not target_cust:
                    session_states[conversation_id] = cls._create_empty_state()
                    return {
                        "response": f"I couldn't find a customer with that phone number ({phone_input}). Please check the number and try again.",
                        "intent": "cancel_appointment",
                        "action_performed": False
                    }

                # Query active booked appointments for this customer only
                appts = await AppointmentService.get_appointments(0, 50, status_filter="Booked", customer_id_filter=target_cust["id"])
                if not appts:
                    session_states[conversation_id] = cls._create_empty_state()
                    return {
                        "response": f"You don't have any active booked appointments to cancel under phone number '{phone_input}'.",
                        "intent": "cancel_appointment",
                        "action_performed": False
                    }

                if len(appts) == 1:
                    state["cancel_target"] = appts[0]
                    state["step"] = "waiting_for_cancel_confirm"
                    target = appts[0]
                    return {
                        "response": f"You selected:\n• Service: {target['service']}\n• Date: {target['appointment_date']} at {target['appointment_time']}\n\nAre you sure you want to cancel this appointment?",
                        "intent": "cancel_appointment",
                        "action_performed": False
                    }
                else:
                    state["active_appts"] = appts
                    state["step"] = "waiting_for_cancel_selection"
                    options_str = "\n".join([f"{idx+1}. {a['service']} — {a['appointment_date']} at {a['appointment_time']}" for idx, a in enumerate(appts)])
                    return {
                        "response": f"Here are your upcoming appointments. Please select the appointment you want to cancel:\n\n{options_str}\n\nPlease reply with the appointment number (e.g., 1 or 2).",
                        "intent": "cancel_appointment",
                        "action_performed": False
                    }

            if state["step"] == "waiting_for_cancel_selection":
                decline_no = ["no", "keep appointment", "don't cancel", "actually don't cancel it", "keep it", "nevermind", "cancel no"]
                if any(k in msg_clean for k in decline_no):
                    session_states[conversation_id] = cls._create_empty_state()
                    logger.info("INFO: Cancellation declined at selection step; appointment preserved.")
                    return {
                        "response": "No problem. Your appointment has been kept.",
                        "intent": "cancel_appointment",
                        "action_performed": False
                    }

                match = re.search(r'\b\d+\b', msg_clean)
                if match and state.get("active_appts"):
                    idx = int(match.group(0)) - 1
                    if 0 <= idx < len(state["active_appts"]):
                        target_appt = state["active_appts"][idx]
                        state["cancel_target"] = target_appt
                        state["step"] = "waiting_for_cancel_confirm"
                        return {
                            "response": f"You selected:\n• Service: {target_appt['service']}\n• Date: {target_appt['appointment_date']} at {target_appt['appointment_time']}\n\nAre you sure you want to cancel this appointment?",
                            "intent": "cancel_appointment",
                            "action_performed": False
                        }

                return {
                    "response": "Please enter a valid appointment number from the list above.",
                    "intent": "cancel_appointment",
                    "action_performed": False
                }

            if state["step"] == "waiting_for_cancel_confirm":
                confirm_yes = ["yes", "confirm", "confirm cancellation", "sure", "cancel it", "yeah", "ok"]
                decline_no = ["no", "keep appointment", "don't cancel", "actually don't cancel it", "keep it", "nevermind", "cancel no"]

                if any(k in msg_clean for k in confirm_yes) and not any(k in msg_clean for k in ["no", "don't"]):
                    target = state.get("cancel_target")
                    if target:
                        await AppointmentService.cancel_appointment(target["id"], target.get("customer_id"))
                        session_states[conversation_id] = cls._create_empty_state()
                        logger.info(f"INFO: Cancelled appointment {target['id']} in MongoDB Atlas")
                        return {
                            "response": f"Your {target['service']} appointment on {target['appointment_date']} at {target['appointment_time']} has been cancelled successfully.",
                            "intent": "cancel_appointment",
                            "action_performed": True
                        }
                elif any(k in msg_clean for k in decline_no):
                    session_states[conversation_id] = cls._create_empty_state()
                    logger.info("INFO: Cancellation declined by user; appointment preserved.")
                    return {
                        "response": "No problem. Your appointment has been kept.",
                        "intent": "cancel_appointment",
                        "action_performed": False
                    }

                return {
                    "response": "Please reply with 'Confirm Cancellation' or 'Keep Appointment' to complete your request.",
                    "intent": "cancel_appointment",
                    "action_performed": False
                }

        # E. STATEFUL APPOINTMENT BOOKING WIZARD
        if target_intent == "book_appointment":
            if state["step"] is None or state["intent"] != "book_appointment":
                session_states[conversation_id] = cls._create_empty_state()
                state = session_states[conversation_id]
                state["intent"] = "book_appointment"
                state["step"] = "waiting_for_service"
                logger.info("INFO: Intent: book_appointment | Starting booking wizard at waiting_for_service")
                return {
                    "response": "Sure! What service would you like to book?",
                    "intent": "book_appointment",
                    "action_performed": False
                }

            if state["step"] == "waiting_for_service":
                state["service"] = message.strip()
                state["step"] = "waiting_for_date"
                logger.info(f"INFO: Booking step waiting_for_service -> service = '{state['service']}'")
                return {
                    "response": f"Got it, {state['service']}. What date would you prefer? (e.g., Tomorrow, Monday, 2026-08-10)",
                    "intent": "book_appointment",
                    "action_performed": False
                }

            elif state["step"] == "waiting_for_date":
                state["date"] = parse_natural_date(message)
                state["step"] = "waiting_for_time"
                logger.info(f"INFO: Booking step waiting_for_date -> date = '{state['date']}'")
                return {
                    "response": f"Selected date: {state['date']}. What time would you prefer? (e.g., 10:00 AM, 2:30 PM)",
                    "intent": "book_appointment",
                    "action_performed": False
                }

            elif state["step"] == "waiting_for_time":
                state["time"] = parse_natural_time(message)
                state["step"] = "waiting_for_name"
                logger.info(f"INFO: Booking step waiting_for_time -> time = '{state['time']}'")
                return {
                    "response": "Selected time: " + state["time"] + ". May I have your full name?",
                    "intent": "book_appointment",
                    "action_performed": False
                }

            elif state["step"] == "waiting_for_name":
                state["name"] = message.strip()
                state["step"] = "waiting_for_phone"
                logger.info(f"INFO: Booking step waiting_for_name -> name = '{state['name']}'")
                return {
                    "response": f"Thank you, {state['name']}. Please provide your phone number to complete the booking.",
                    "intent": "book_appointment",
                    "action_performed": False
                }

            elif state["step"] == "waiting_for_phone":
                state["phone"] = extract_phone(message)
                t_db_start = time.time()
                logger.info(f"INFO: Completing booking for {state['name']} ({state['phone']})")

                customers = await CustomerService.get_customers(0, 100)
                existing_cust = next((c for c in customers if c["phone"] == state["phone"] or c["name"].lower() == state["name"].lower()), None)

                if existing_cust:
                    cust_id = existing_cust["id"]
                    cust_name = existing_cust["name"]
                else:
                    new_cust = await CustomerService.create_customer(CustomerCreate(
                        name=state["name"],
                        phone=state["phone"],
                        email=f"{state['name'].lower().replace(' ', '')}@example.com"
                    ))
                    cust_id = new_cust["id"]
                    cust_name = new_cust["name"]

                appt_in = AppointmentCreate(
                    customer_id=cust_id,
                    service=state["service"],
                    appointment_date=state["date"],
                    appointment_time=state["time"],
                    status="Booked"
                )
                await AppointmentService.create_appointment(appt_in)
                t_db = time.time() - t_db_start

                saved_service = state["service"]
                saved_date = state["date"]
                saved_time = state["time"]

                session_states[conversation_id] = cls._create_empty_state()

                t_total = time.time() - t_start
                logger.info(f"[PERFORMANCE] Intent: book_appointment | DB query: {t_db:.3f}s | Total: {t_total:.3f}s")
                return {
                    "response": f"Your {saved_service} appointment is successfully booked for {saved_time} on {saved_date}. Thank you, {cust_name}!",
                    "intent": "book_appointment",
                    "action_performed": True
                }

        # ----------------------------------------------------
        # 3. OLLAMA FALLBACK (For General Unhandled Questions)
        # ----------------------------------------------------
        t_llm_start = time.time()
        if conversation_id not in session_memory:
            session_memory[conversation_id] = [{"role": "system", "content": cls.get_system_prompt()}]

        session_memory[conversation_id].append({"role": "user", "content": message})
        recent = session_memory[conversation_id][-4:] if len(session_memory[conversation_id]) > 4 else session_memory[conversation_id][1:]
        temp_messages = [session_memory[conversation_id][0]] + recent

        model_res = await cls.query_ollama(temp_messages)
        t_llm = time.time() - t_llm_start

        response_text = model_res.get("response", "Hello! How can I assist you with your appointment today?")
        intent = model_res.get("intent", "other")

        session_memory[conversation_id].append({"role": "assistant", "content": response_text})

        t_total = time.time() - t_start
        logger.info(f"[PERFORMANCE] Intent: {intent} (Ollama Fallback) | Ollama generation: {t_llm:.3f}s | Total: {t_total:.3f}s")

        return {
            "response": response_text,
            "intent": intent,
            "action_performed": False
        }
