#!/usr/bin/env python3
"""
PDF Text Extractor using OCR with layout detection
Uses Tesseract OCR on page images for proper column handling
"""

import sys
import json
import os
import subprocess
import tempfile

def ocr_page_image(image_path: str) -> str:
    """Use Tesseract OCR on a page image with layout detection."""
    try:
        # Run Tesseract with Slovak language and automatic page segmentation
        result = subprocess.run(
            ['tesseract', image_path, 'stdout', '-l', 'slk+ces+eng', '--psm', '1'],
            capture_output=True,
            text=True,
            timeout=60
        )
        return result.stdout.strip()
    except subprocess.TimeoutExpired:
        return ""
    except Exception as e:
        return ""

def extract_from_pdf(pdf_path: str) -> dict:
    """Extract text from PDF using OCR on rendered page images."""
    result = {
        "success": True,
        "pages": [],
        "fullText": "",
        "error": None
    }
    
    try:
        # Create temp directory for page images
        with tempfile.TemporaryDirectory() as tmpdir:
            # Convert PDF pages to images using pdftoppm
            img_prefix = os.path.join(tmpdir, "page")
            subprocess.run(
                ['pdftoppm', '-png', '-r', '300', pdf_path, img_prefix],
                capture_output=True,
                timeout=120
            )
            
            # Find all generated page images
            page_images = sorted([
                os.path.join(tmpdir, f) 
                for f in os.listdir(tmpdir) 
                if f.startswith('page-') and f.endswith('.png')
            ])
            
            if not page_images:
                # Fallback: try different naming pattern
                page_images = sorted([
                    os.path.join(tmpdir, f) 
                    for f in os.listdir(tmpdir) 
                    if f.endswith('.png')
                ])
            
            all_text = []
            
            for i, img_path in enumerate(page_images, 1):
                page_text = ocr_page_image(img_path)
                
                result["pages"].append({
                    "pageNumber": i,
                    "text": page_text,
                    "hasColumns": True  # OCR handles columns automatically
                })
                all_text.append(page_text)
            
            result["fullText"] = '\n\n'.join(all_text)
            
            if not page_images:
                result["success"] = False
                result["error"] = "No page images could be generated"
                
    except Exception as e:
        result["success"] = False
        result["error"] = str(e)
    
    return result


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No PDF path provided"}))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    result = extract_from_pdf(pdf_path)
    print(json.dumps(result, ensure_ascii=False))
