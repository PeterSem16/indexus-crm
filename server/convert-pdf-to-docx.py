#!/usr/bin/env python3
import sys
import os

def convert_pdf_to_docx(pdf_path: str, output_path: str) -> bool:
    try:
        from pdf2docx import Converter
        
        cv = Converter(pdf_path)
        cv.convert(output_path, start=0, end=None)
        cv.close()
        
        if os.path.exists(output_path):
            print(f"SUCCESS: {output_path}")
            return True
        else:
            print("ERROR: Output file not created")
            return False
            
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return False

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: convert-pdf-to-docx.py <input.pdf> <output.docx>")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    output_path = sys.argv[2]
    
    if not os.path.exists(pdf_path):
        print(f"ERROR: Input file not found: {pdf_path}")
        sys.exit(1)
    
    success = convert_pdf_to_docx(pdf_path, output_path)
    sys.exit(0 if success else 1)
