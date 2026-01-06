#!/usr/bin/env python3
"""
PDF Text Extractor with Two-Column Detection
Extracts text from two-column PDFs in correct reading order:
- First reads entire LEFT column (top to bottom)
- Then reads entire RIGHT column (top to bottom)
"""

import sys
import json
import pdfplumber

def extract_with_columns(pdf_path: str) -> dict:
    """Extract text from PDF with intelligent two-column detection."""
    result = {
        "success": True,
        "pages": [],
        "fullText": "",
        "error": None
    }
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            all_text = []
            
            for page_num, page in enumerate(pdf.pages, 1):
                page_width = page.width
                mid_x = page_width / 2
                
                # Extract words with bounding boxes
                words = page.extract_words(
                    keep_blank_chars=False,
                    x_tolerance=3,
                    y_tolerance=3
                )
                
                if not words:
                    simple_text = page.extract_text() or ""
                    result["pages"].append({
                        "pageNumber": page_num,
                        "text": simple_text,
                        "hasColumns": False
                    })
                    all_text.append(simple_text)
                    continue
                
                # Separate words into LEFT and RIGHT columns
                # Use a gap in the middle to distinguish columns
                gap_left = mid_x - 30  # Left column ends here
                gap_right = mid_x + 10  # Right column starts here
                
                left_words = []
                right_words = []
                
                for w in words:
                    word_center = (w['x0'] + w['x1']) / 2
                    if word_center < gap_left:
                        left_words.append(w)
                    elif word_center > gap_right:
                        right_words.append(w)
                    else:
                        # Words in the gap - assign based on x0
                        if w['x0'] < mid_x:
                            left_words.append(w)
                        else:
                            right_words.append(w)
                
                # Check if this is truly a two-column layout
                has_columns = len(left_words) > 20 and len(right_words) > 20
                
                def words_to_text(word_list):
                    """Convert word list to text, preserving line structure."""
                    if not word_list:
                        return ""
                    
                    # Sort by vertical position first, then horizontal
                    sorted_words = sorted(word_list, key=lambda w: (w['top'], w['x0']))
                    
                    lines = []
                    current_line_words = []
                    current_top = None
                    
                    for word in sorted_words:
                        if current_top is None:
                            current_top = word['top']
                            current_line_words = [word]
                        elif abs(word['top'] - current_top) < 10:
                            # Same line
                            current_line_words.append(word)
                        else:
                            # New line - save current line
                            current_line_words.sort(key=lambda w: w['x0'])
                            line_text = ' '.join(w['text'] for w in current_line_words)
                            lines.append(line_text)
                            current_line_words = [word]
                            current_top = word['top']
                    
                    # Don't forget last line
                    if current_line_words:
                        current_line_words.sort(key=lambda w: w['x0'])
                        line_text = ' '.join(w['text'] for w in current_line_words)
                        lines.append(line_text)
                    
                    return '\n'.join(lines)
                
                if has_columns:
                    # Read LEFT column completely, then RIGHT column
                    left_text = words_to_text(left_words)
                    right_text = words_to_text(right_words)
                    
                    # Combine with clear separation
                    page_text = left_text + '\n\n' + right_text
                else:
                    # Single column - just read normally
                    page_text = words_to_text(words)
                
                result["pages"].append({
                    "pageNumber": page_num,
                    "text": page_text,
                    "hasColumns": has_columns
                })
                all_text.append(page_text)
            
            result["fullText"] = '\n\n'.join(all_text)
            
    except Exception as e:
        result["success"] = False
        result["error"] = str(e)
    
    return result


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No PDF path provided"}))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    result = extract_with_columns(pdf_path)
    print(json.dumps(result, ensure_ascii=False))
