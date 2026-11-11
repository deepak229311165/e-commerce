import smtplib
from config import Settings
from dataclasses import dataclass
from typing import Optional
from email.mime.text import MIMEText

settings = Settings()

@dataclass
class SMTPSettings:
    host: str
    port: int
    use_tls: bool
    use_ssl: bool

SMTP_PROFILES = {
    "gmail": SMTPSettings(host="smtp.gmail.com", port=587, use_ssl=False, use_tls=True),
    "outlook": SMTPSettings(host="smtp.office365.com", port=587, use_tls=True, use_ssl=False),
    "sendgrid": SMTPSettings(host="smtp.sendgrid.net", port=587, use_tls=True, use_ssl=False),
    "aws_ses": SMTPSettings(host="email-smtp.us-east-1.amazonaws.com", port=587, use_tls=True, use_ssl=False),
    "mailgun": SMTPSettings(host="smtp.mailgun.org", port=587, use_tls=True, use_ssl=False),
    "yahoo": SMTPSettings(host="smtp.mail.yahoo.com", port=587, use_tls=True, use_ssl=False),
}

def get_smtp_settings(
        provider: str,
        custom_host: Optional[str] = None,
        custom_port: int = 587,
        use_ssl: bool = False,
) -> SMTPSettings:
    if provider in SMTP_PROFILES:
        return SMTP_PROFILES[provider]
    else:
        return SMTPSettings(host=custom_host or settings.SMTP_HOST, port=custom_port, use_ssl=use_ssl, use_tls=not use_ssl)
    host = customer_host or provider
    use_tls = not use_ssl and custom_port == 587
    return SMTPSettings(host=host, port=custom_port, use_ssl=use_ssl, use_tls=use_tls)

def open_smtp_connection(config):
    smtp = get_smtp_settings(
        provider=config.get("provider", "custom"),
        custom_host=config.get("smtp_host"),
        custom_port=config.get("smtp_port", 587),
        use_ssl=config.get("use_ssl", False)
    )
    if smtp.use_ssl:
        server = smtplib.SMTP_SSL(smtp.host, smtp.port)
    else:
        server = smtplib.SMTP(smtp.host, smtp.port, timeout=30)
        if smtp.use_tls:
            server.starttls()
        server.login(config["sender_email"], config["sender_password"])
        return server

def build_message(config, recipient, processed_html, plain_text_body, cid_map):


    message = MIMEMultipart("alternative")
    message["Subject"] = config["subject"]
    message["From"] = config["sender_email"]
    message["To"] = recipient

    part1 = MIMEText(plain_text, "plain")
    part2 = MIMEText(processed_html, "html")

    message.attach(part1)
    message.attach(part2)

    return message

