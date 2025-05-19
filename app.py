import os
import pytesseract
from flask import Flask, render_template
from bs4 import BeautifulSoup
import re

OCR_LANGUAGES = 'chi_sim'
UPLOAD_FOLDER = 'uploads'
STATIC_FOLDER = 'static'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'bmp', 'tiff'}

app = Flask(__name__, static_folder=STATIC_FOLDER) # 指定 static_folder
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB 上传限制

if not os.path.exists(os.path.join(STATIC_FOLDER, UPLOAD_FOLDER)):
    os.makedirs(os.path.join(STATIC_FOLDER, UPLOAD_FOLDER))

def parse_bbox(title_string):
    """从title字符串中解析 'bbox x1 y1 x2 y2'"""
    match = re.search(r'bbox\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)', title_string)
    if match:
        return [int(c) for c in match.groups()]
    return None

def perform_ocr_web(pil_image):
    words_data = []
    try:
        hocr_output = pytesseract.image_to_pdf_or_hocr(pil_image, lang=OCR_LANGUAGES, extension='hocr')
        soup = BeautifulSoup(hocr_output, 'html.parser')
        
        global_idx = 0

        for line_idx, line_element in enumerate(soup.find_all('span', class_='ocr_line')):
            line_bbox = parse_bbox(line_element.get('title', ''))
            if not line_bbox:
                continue

            for word_idx, word_element in enumerate(line_element.find_all('span', class_='ocrx_word')):
                word_text = word_element.text
                word_bbox = parse_bbox(word_element.get('title', ''))
                if not word_text or not word_bbox:
                    continue
                x1, y1, x2, y2 = word_bbox
                js_box = [x1, y1, x2 - x1, y2 - y1] # 转换为 [x, y, width, height]
                words_data.append({
                    'word': word_text.strip(),
                    'box': js_box,
                    'line_index': line_idx,
                    'word_index': word_idx,
                    'global_index': global_idx
                })
                global_idx += 1
        words_data.sort(key=lambda c: c['global_index'])
        return words_data

    except pytesseract.TesseractNotFoundError:
        raise Exception("Tesseract is not installed or not found in your PATH.")
    except Exception as e:
        print(f"Error during OCR or parsing: {e}")
        raise Exception(f"An error occurred during OCR: {str(e)}")


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    """渲染主页面"""
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_image():
    """TODO"""
    pass

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    """TODO"""
    pass

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
