# Image OCR

我们要实现微信的图片OCR效果，即

1. 上传一张图片
2. 在网页上可以按下鼠标，移动，再松开
3. 系统会识别出鼠标选中的文字，可以复制这组文字

<video src="https://github.com/thyecust/ocr_demo/raw/refs/heads/main/static/example.mp4" controls preload></video>

环境配置

1. 安装pytesseract，确保可以解析中文图片：`print(pytesseract.image_to_string(Image.open('test.png'), lang='chi_sim'))`
2. 安装app.py中的依赖：`pip install pytesseract flask bs4`
3. 启动应用：`python3 app.py`

你的任务是补充`app.py`中的`upload_image`和`uploaded_file`两个函数，使系统能正常运行。

提交方式：
1. 不要直接fork这个仓库，请clone这个仓库，然后完成任务
2. 在github上创建一个新私有仓库，把本仓库作者加入，告知HR
