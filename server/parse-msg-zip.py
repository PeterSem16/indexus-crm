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

FULL_NAME_VAR = '{{customer.firstName}} {{customer.lastName}}'

VARIABLE_PATTERNS = [
    (r'\b(?:meno a priezvisko|jméno a příjmení|full.?name|celé jméno|celé meno)\b', FULL_NAME_VAR),
    (r'\b(?:meno|jméno|name|ime|nome|név|nume|vorname|first.?name|krstné meno|křestní jméno)\b', '{{customer.firstName}}'),
    (r'\b(?:priezvisko|příjmení|surname|last.?name|nachname|cognome|vezetéknév|numele de familie)\b', '{{customer.lastName}}'),
    (r'\b(?:rodné číslo|birth.?number|születési szám|cod numeric personal)\b', '{{customer.birthNumber}}'),
    (r'\b(?:číslo zmluvy|číslo smlouvy|contract.?number|vertragsnummer|numero contratto|szerződésszám|număr contract)\b', '{{contract.contractNumber}}'),
    (r'\b(?:dátum narodenia|datum narození|date.?of.?birth|születési dátum|data nașterii|geburtsdatum)\b', '{{customer.dateOfBirth}}'),
    (r'\b(?:telefón|telefon|phone|telefono|telefon|telefon|tel\.?č|číslo telefónu)\b', '{{customer.phone}}'),
    (r'\b(?:e[\-‑]?mail(?:ov[áa])?(?:\s+adresa)?)\b', '{{customer.email}}'),
    (r'\b(?:adresa|address|indirizzo|cím|adresă|adresse|bydlisko|bydliště)\b', '{{customer.address}}'),
    (r'\b(?:ičo|ič|ico|id.?number|identifikačné číslo)\b', '{{company.companyId}}'),
    (r'\b(?:dátum registrácie|datum registrace|registration.?date)\b', '{{contract.registrationDate}}'),
]

SALUTATION_PATTERNS = [
    (r'(Vážen[áý]\s+pan[ie]?\s+)', r'\1' + FULL_NAME_VAR + ', '),
    (r'(Vážen[áý]\s+)', r'\1' + FULL_NAME_VAR + ', '),
    (r'(Dobrý deň,?\s*)', r'\1' + FULL_NAME_VAR + ', '),
    (r'(Dobrý den,?\s*)', r'\1' + FULL_NAME_VAR + ', '),
    (r'(Ahoj,?\s*)', r'\1' + FULL_NAME_VAR + ', '),
    (r'(Dear\s+)', r'\1' + FULL_NAME_VAR + ', '),
    (r'(Sehr geehrte[r]?\s+)', r'\1' + FULL_NAME_VAR + ', '),
    (r'(Gentile\s+)', r'\1' + FULL_NAME_VAR + ', '),
    (r'(Tisztelt\s+)', r'\1' + FULL_NAME_VAR + ', '),
    (r'(Stimate?\s+)', r'\1' + FULL_NAME_VAR + ', '),
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


def insert_salutation_variables(html_content):
    if not html_content:
        return html_content
    for pattern, replacement in SALUTATION_PATTERNS:
        if re.search(pattern, html_content):
            html_content = re.sub(pattern, replacement, html_content, count=1)
            break
    return html_content


def extract_font_size(style_str):
    m = re.search(r'font-size\s*:\s*([^;"\'>]+)', style_str or '')
    if m:
        return m.group(1).strip()
    return None


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

    html_content = re.sub(r'<!--\[if.*?\]>.*?<!\[endif\]-->', '', html_content, flags=re.DOTALL)
    html_content = re.sub(r'<!--.*?-->', '', html_content, flags=re.DOTALL)
    html_content = re.sub(r'<xml[^>]*>.*?</xml>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
    html_content = re.sub(r'<o:p>\s*</o:p>', '', html_content, flags=re.DOTALL)
    html_content = re.sub(r'<o:p>(.*?)</o:p>', r'\1', html_content, flags=re.DOTALL)
    html_content = re.sub(r'</?o:[^>]+>', '', html_content)
    html_content = re.sub(r'</?v:[^>]+>', '', html_content)
    html_content = re.sub(r'</?w:[^>]+>', '', html_content)
    html_content = re.sub(r'\s*xmlns:[a-z]+="[^"]*"', '', html_content)

    body_match = re.search(r'<body[^>]*>(.*?)</body>', html_content, re.DOTALL | re.IGNORECASE)
    if body_match:
        html_content = body_match.group(1)

    html_content = re.sub(r'\s*class="Mso[^"]*"', '', html_content)

    def clean_style_attr(match):
        full = match.group(0)
        style_content = match.group(1)
        keep_props = []
        props = re.split(r';', style_content)
        for prop in props:
            prop = prop.strip()
            if not prop:
                continue
            if re.match(r'mso-', prop, re.IGNORECASE):
                continue
            if re.match(r'tab-stops', prop, re.IGNORECASE):
                continue
            keep_props.append(prop)
        if keep_props:
            return f' style="{"; ".join(keep_props)}"'
        return ''

    html_content = re.sub(r'\s*style="([^"]*)"', clean_style_attr, html_content)

    html_content = re.sub(r'<style[^>]*>.*?</style>', '', html_content, flags=re.DOTALL | re.IGNORECASE)

    html_content = re.sub(r'\n\s*\n\s*\n', '\n\n', html_content)
    html_content = html_content.strip()

    return html_content


def extract_number_prefix(filename):
    basename = os.path.splitext(os.path.basename(filename))[0]
    m = re.match(r'^template[_\s]*(\d+)[_\s]*[-_]\s*(.*)', basename, re.IGNORECASE)
    if m:
        return m.group(1), m.group(2).strip(' -_')
    m = re.match(r'^(\d+)[_\s.\-]+(.+)', basename)
    if m:
        return m.group(1), m.group(2).strip(' -_')
    return None, basename


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

                subject = msg.subject or ""

                html_body = ""
                plain_body = msg.body or ""

                if msg.htmlBody:
                    raw_html = msg.htmlBody
                    html_body = clean_html(raw_html)

                if not html_body and plain_body:
                    lines = plain_body.split('\n')
                    html_parts = []
                    for line in lines:
                        escaped = line.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                        if escaped.strip():
                            html_parts.append(f'<p>{escaped}</p>')
                        else:
                            html_parts.append('<p>&nbsp;</p>')
                    html_body = '\n'.join(html_parts)

                html_body = insert_salutation_variables(html_body)

                detected_vars = detect_variables(plain_body or html_body)
                if '{{customer.firstName}}' in html_body and '{{customer.firstName}}' not in detected_vars:
                    detected_vars.append('{{customer.firstName}}')
                if '{{customer.lastName}}' in html_body and '{{customer.lastName}}' not in detected_vars:
                    detected_vars.append('{{customer.lastName}}')

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

                num_prefix, name_part = extract_number_prefix(name)
                if subject:
                    if num_prefix:
                        template_name = f"{num_prefix} - {subject}"
                    else:
                        template_name = subject
                else:
                    if num_prefix:
                        template_name = f"{num_prefix} - {name_part}"
                    else:
                        template_name = name_part

                if not template_name.strip():
                    template_name = os.path.splitext(os.path.basename(name))[0]

                results.append({
                    "fileName": name,
                    "subject": subject or template_name,
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
