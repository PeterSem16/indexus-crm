#!/usr/bin/env python3
import sys
import json
import os
import zipfile
import tempfile
import base64
import re

try:
    import extract_msg
except ImportError:
    print(json.dumps({"error": "extract_msg not installed"}))
    sys.exit(1)

VARIABLE_PATTERNS = [
    (r'\b(?:meno|jméno|name|meno a priezvisko|jméno a příjmení|ime|nome|név|nume|vorname)\b', '{{customer_first_name}}'),
    (r'\b(?:priezvisko|příjmení|surname|last.?name|nachname|cognome|vezetéknév|numele)\b', '{{customer_last_name}}'),
    (r'\b(?:meno a priezvisko|jméno a příjmení|full.?name|celé jméno)\b', '{{customer_name}}'),
    (r'\b(?:rodné číslo|birth.?number|születési szám|cod numeric)\b', '{{birth_number}}'),
    (r'\b(?:číslo zmluvy|číslo smlouvy|contract.?number|vertragsnummer|numero contratto|szerződésszám|număr contract)\b', '{{contract_number}}'),
    (r'\b(?:dátum narodenia|datum narození|date.?of.?birth|születési dátum|data nașterii)\b', '{{date_of_birth}}'),
    (r'\b(?:telefón|telefon|phone|telefono|telefon|telefon)\b', '{{phone}}'),
    (r'\b(?:e-?mail|email)\b', '{{email}}'),
    (r'\b(?:adresa|address|indirizzo|cím|adresă|adresse)\b', '{{address}}'),
]

def detect_variables(text):
    if not text:
        return []
    found = set()
    text_lower = text.lower()
    for pattern, var_name in VARIABLE_PATTERNS:
        if re.search(pattern, text_lower, re.IGNORECASE):
            found.add(var_name)
    return list(found)


def clean_html(html_content):
    if not html_content:
        return ""
    if isinstance(html_content, bytes):
        for enc in ['utf-8', 'windows-1250', 'windows-1252', 'iso-8859-2', 'latin1']:
            try:
                html_content = html_content.decode(enc)
                break
            except (UnicodeDecodeError, AttributeError):
                continue
        else:
            html_content = html_content.decode('utf-8', errors='replace')

    html_content = re.sub(r'<style[^>]*>.*?</style>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
    html_content = re.sub(r'<xml[^>]*>.*?</xml>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
    html_content = re.sub(r'<!--\[if.*?\]>.*?<!\[endif\]-->', '', html_content, flags=re.DOTALL)
    html_content = re.sub(r'<!--.*?-->', '', html_content, flags=re.DOTALL)
    html_content = re.sub(r'\s*mso-[^;"]+;?', '', html_content)
    html_content = re.sub(r'\s*class="Mso[^"]*"', '', html_content)
    html_content = re.sub(r'<o:p>.*?</o:p>', '', html_content, flags=re.DOTALL)
    html_content = re.sub(r'</?o:[^>]+>', '', html_content)
    html_content = re.sub(r'</?v:[^>]+>', '', html_content)
    html_content = re.sub(r'</?w:[^>]+>', '', html_content)
    html_content = re.sub(r'\s*xmlns:[a-z]+="[^"]*"', '', html_content)

    body_match = re.search(r'<body[^>]*>(.*?)</body>', html_content, re.DOTALL | re.IGNORECASE)
    if body_match:
        html_content = body_match.group(1)

    html_content = re.sub(r'\n\s*\n', '\n', html_content)
    html_content = html_content.strip()

    return html_content


def process_zip(zip_path):
    results = []

    with zipfile.ZipFile(zip_path, 'r') as zf:
        msg_names = [n for n in zf.namelist() if n.lower().endswith('.msg') and not n.startswith('__MACOSX')]
        total = len(msg_names)

        for idx, name in enumerate(msg_names):
            progress = {"current": idx + 1, "total": total, "name": name}
            print(json.dumps({"progress": progress}), flush=True)

            with tempfile.NamedTemporaryFile(suffix='.msg', delete=False) as tmp:
                tmp.write(zf.read(name))
                tmp_path = tmp.name

            try:
                msg = extract_msg.Message(tmp_path)

                subject = msg.subject or os.path.splitext(os.path.basename(name))[0]

                html_body = ""
                plain_body = msg.body or ""

                if msg.htmlBody:
                    raw_html = msg.htmlBody
                    html_body = clean_html(raw_html)

                detected_vars = detect_variables(plain_body or html_body)

                attachments_data = []
                for att in msg.attachments:
                    try:
                        content_id = getattr(att, 'contentId', None) or getattr(att, 'cid', None)
                        is_inline = bool(content_id)
                        filename = att.longFilename or att.shortFilename or 'attachment'
                        data = att.data

                        if data and len(data) > 0:
                            b64_data = base64.b64encode(data).decode('ascii')
                            ext = os.path.splitext(filename)[1].lower()
                            mime_map = {
                                '.pdf': 'application/pdf',
                                '.png': 'image/png',
                                '.jpg': 'image/jpeg',
                                '.jpeg': 'image/jpeg',
                                '.gif': 'image/gif',
                                '.doc': 'application/msword',
                                '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                                '.xls': 'application/vnd.ms-excel',
                                '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                            }
                            mime_type = mime_map.get(ext, 'application/octet-stream')

                            if is_inline and ext in ['.png', '.jpg', '.jpeg', '.gif']:
                                data_uri = f"data:{mime_type};base64,{b64_data}"
                                if html_body and content_id:
                                    html_body = html_body.replace(f'cid:{content_id}', data_uri)
                            else:
                                attachments_data.append({
                                    "fileName": filename,
                                    "mimeType": mime_type,
                                    "size": len(data),
                                    "data": b64_data,
                                    "isInline": is_inline,
                                    "contentId": content_id,
                                })
                    except Exception as att_err:
                        pass

                template_name = subject
                template_name = re.sub(r'^template_\d+_', '', template_name, flags=re.IGNORECASE)
                template_name = template_name.strip(' -_')
                if not template_name:
                    template_name = os.path.splitext(os.path.basename(name))[0]

                results.append({
                    "fileName": name,
                    "subject": subject,
                    "name": template_name,
                    "htmlBody": html_body,
                    "plainBody": plain_body,
                    "detectedVariables": detected_vars,
                    "attachments": attachments_data,
                    "attachmentCount": len(attachments_data),
                })

                msg.close()
            except Exception as e:
                results.append({
                    "fileName": name,
                    "error": str(e),
                })
            finally:
                try:
                    os.unlink(tmp_path)
                except:
                    pass

    return results


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: parse-msg-zip.py <zip_path>"}))
        sys.exit(1)

    zip_path = sys.argv[1]
    if not os.path.exists(zip_path):
        print(json.dumps({"error": f"File not found: {zip_path}"}))
        sys.exit(1)

    try:
        results = process_zip(zip_path)
        print(json.dumps({"result": results, "total": len(results)}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
