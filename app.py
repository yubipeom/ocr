import os
import pytesseract
from flask import Flask, render_template, request, jsonify, send_from_directory
from bs4 import BeautifulSoup
import re
from PIL import Image
import uuid

OCR_LANGUAGES = 'chi_sim'#test
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
    """处理图片上传和OCR识别"""
    try:
        # 检查是否有文件上传
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': '没有选择文件'}), 400
        
        file = request.files['file']
        
        # 检查文件名是否为空
        if file.filename == '':
            return jsonify({'success': False, 'error': '没有选择文件'}), 400
        
        # 检查文件格式
        if not allowed_file(file.filename):
            return jsonify({'success': False, 'error': '不支持的文件格式'}), 400
        
        # 生成唯一文件名
        file_extension = file.filename.rsplit('.', 1)[1].lower()
        unique_filename = f"{uuid.uuid4().hex}.{file_extension}"
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        
        # 确保上传目录存在
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
        
        # 保存文件
        file.save(file_path)
        
        # 使用PIL打开图片
        pil_image = Image.open(file_path)
        
        # 获取图片尺寸
        image_width, image_height = pil_image.size
        
        # 执行OCR识别
        ocr_data = perform_ocr_web(pil_image)
        
        # 返回结果
        return jsonify({
            'success': True,
            'imageUrl': f'/uploads/{unique_filename}',
            'imageWidth': image_width,
            'imageHeight': image_height,
            'ocrData': ocr_data
        })
        
    except Exception as e:
        print(f"Upload error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    """提供上传文件的访问"""
    try:
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)
    except FileNotFoundError:
        return jsonify({'error': '文件不存在'}), 404

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
