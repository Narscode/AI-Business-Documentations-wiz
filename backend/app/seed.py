"""Seed initial users and a sample business document so the demo works
out of the box. Runs once on first startup.
"""

from __future__ import annotations

from sqlalchemy import select

from .database import SessionLocal
from .models import Document, User

SAMPLE_DOC_TITLE = "Wizlynn Customer Support Playbook"
SAMPLE_DOC_TEXT = """Wizlynn Customer Support Playbook

1. Greeting and Identification
Every customer interaction must begin with the agent stating their name and Wizlynn role within \
the first ten seconds. The agent must then ask for and verify the customer's account email and \
account PIN before discussing any account-specific information. Disclosing account data without \
PIN verification is a P0 compliance violation and must be escalated to the Security team \
immediately.

2. Conversation Timeout Rules
Inbound chat conversations have two timeout thresholds. After 90 seconds of customer silence the \
agent must send a check-in message ("Are you still there? I'm here to help when you're ready."). \
After a further 4 minutes of silence the conversation is automatically closed with a polite \
closing message and the case is marked "abandoned-customer-silent". Agents must not close \
conversations manually inside the 4-minute window. Voice calls have a single 60-second silence \
threshold and are auto-disconnected after that.

3. Escalation Tiers
Wizlynn uses three escalation tiers. Tier 1 (Front Line Support) handles standard account, \
billing, and product-usage questions. Tier 2 (Specialist Support) handles refund disputes, \
data-export requests, and integration debugging. Tier 3 (Engineering On-Call) handles platform \
outages, data-loss incidents, and security events. Front-line agents must escalate to Tier 2 \
if they cannot resolve an issue within 15 minutes. Tier 2 must escalate to Tier 3 within 5 \
minutes for any incident classified as P0 or P1. Skipping a tier (Tier 1 directly to Tier 3) \
is not permitted except for an active security incident.

4. Refund Policy
Wizlynn offers a 14-day full refund on monthly subscriptions and a 30-day full refund on annual \
subscriptions, no questions asked. After those windows, refunds are granted only for cases of \
extended platform unavailability (> 4 hours of downtime in the billing month). Pro-rated \
refunds for cancellation mid-cycle are not offered — customers retain access until the end of \
the paid period. All refund decisions outside the standard windows require Tier 2 approval.

5. Data Export Requests
Customers may request a full export of their workspace data at any time. The export is \
delivered as a downloadable ZIP within 48 hours and contains all documents, comments, and \
metadata associated with the requesting user. Workspace admins may request a workspace-wide \
export which is delivered within 72 hours. Personal exports are self-service via the Settings \
page; agents should redirect customers there before opening a ticket.

6. Identifying Phishing Attempts
Wizlynn will never ask for a customer's password, full credit card number, or two-factor recovery \
codes in any chat, email, or call. If a customer reports being asked for these by someone \
claiming to be Wizlynn, the agent must (a) instruct the customer not to share the information, \
(b) collect the timestamp and contact channel of the suspicious message, and (c) file a Tier 3 \
security ticket within 5 minutes. The agent must also walk the customer through enabling 2FA \
if they have not already done so.
"""


def seed_if_empty() -> None:
    with SessionLocal() as db:
        if db.scalar(select(User.id).limit(1)) is not None:
            return

        admin = User(name="Alex Chen", email="alex@wizlynn.example", role="admin")
        manager = User(name="Priya Sharma", email="priya@wizlynn.example", role="manager")
        employee = User(name="Jordan Lee", email="jordan@wizlynn.example", role="employee")
        db.add_all([admin, manager, employee])
        db.flush()

        sample = Document(
            title=SAMPLE_DOC_TITLE,
            original_filename="wizlynn_playbook.md",
            mime_type="text/markdown",
            content_text=SAMPLE_DOC_TEXT,
            status="uploaded",
            uploaded_by_id=admin.id,
        )
        db.add(sample)
        db.commit()
