#!/usr/bin/env python3
"""
PDF Text Extractor with Column Detection
Extracts text from two-column PDFs in correct reading order
"""

import sys
import json
import pdfplumber
from collections import defaultdict

def extract_with_columns(pdf_path: str) -> dict:
    """Extract text from PDF with intelligent column detection."""
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
                page_height = page.height
                mid_x = page_width / 2
                
                # Extract words with bounding boxes
                words = page.extract_words(
                    keep_blank_chars=False,
                    x_tolerance=3,
                    y_tolerance=3,
                    extra_attrs=['fontname', 'size']
                )
                
                if not words:
                    # Fallback to simple text extraction
                    simple_text = page.extract_text() or ""
                    result["pages"].append({
                        "pageNumber": page_num,
                        "text": simple_text,
                        "hasColumns": False
                    })
                    all_text.append(simple_text)
                    continue
                
                # Detect if this is a two-column layout
                left_words = [w for w in words if w['x0'] < mid_x - 20]
                right_words = [w for w in words if w['x0'] >= mid_x - 20]
                
                # Check if there's significant content in both columns
                has_columns = len(left_words) > 10 and len(right_words) > 10
                
                if has_columns:
                    # Sort words by column, then by vertical position
                    # Group into lines first
                    def get_lines(word_list):
                        if not word_list:
                            return []
                        
                        # Sort by y position (top to bottom)
                        sorted_words = sorted(word_list, key=lambda w: (w['top'], w['x0']))
                        
                        lines = []
                        current_line = [sorted_words[0]]
                        current_top = sorted_words[0]['top']
                        
                        for word in sorted_words[1:]:
                            # Same line if y position is similar (within 5 pixels)
                            if abs(word['top'] - current_top) < 8:
                                current_line.append(word)
                            else:
                                # Sort current line left-to-right and add
                                current_line.sort(key=lambda w: w['x0'])
                                lines.append(' '.join(w['text'] for w in current_line))
                                current_line = [word]
                                current_top = word['top']
                        
                        # Don't forget last line
                        if current_line:
                            current_line.sort(key=lambda w: w['x0'])
                            lines.append(' '.join(w['text'] for w in current_line))
                        
                        return lines
                    
                    # Process left column first, then right column
                    left_lines = get_lines(left_words)
                    right_lines = get_lines(right_words)
                    
                    # Combine: left column text, then right column text
                    page_text = '\n'.join(left_lines) + '\n\n' + '\n'.join(right_lines)
                else:
                    # Single column - just sort by position
                    sorted_words = sorted(words, key=lambda w: (w['top'], w['x0']))
                    
                    lines = []
                    current_line = [sorted_words[0]] if sorted_words else []
                    current_top = sorted_words[0]['top'] if sorted_words else 0
                    
                    for word in sorted_words[1:]:
                        if abs(word['top'] - current_top) < 8:
                            current_line.append(word)
                        else:
                            current_line.sort(key=lambda w: w['x0'])
                            lines.append(' '.join(w['text'] for w in current_line))
                            current_line = [word]
                            current_top = word['top']
                    
                    if current_line:
                        current_line.sort(key=lambda w: w['x0'])
                        lines.append(' '.join(w['text'] for w in current_line))
                    
                    page_text = '\n'.join(lines)
                
                result["pages"].append({
                    "pageNumber": page_num,
                    "text": page_text,
                    "hasColumns": has_columns
                })
                all_text.append(page_text)
            
            result["fullText"] = '\n\n--- Page Break ---\n\n'.join(all_text)
            
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
