// static/js/main.js
document.addEventListener('DOMContentLoaded', () => {
    const imageUpload = document.getElementById('imageUpload');
    const ocrImage = document.getElementById('ocrImage');
    const selectionCanvas = document.getElementById('selectionCanvas');
    const statusMessages = document.getElementById('statusMessages');
    const copySelectedTextButton = document.getElementById('copySelectedText');
    const selectedTextPreview = document.getElementById('selectedTextPreview');

    const ctx = selectionCanvas.getContext('2d');
    let ocrDataGlobal = []; // Will store word data from backend
    let selectionStartPoint = null; 
    let currentSelectionRect = null; 
    let selectedWordIndices = []; // Stores global_index of selected words
    
    let imageScaleX = 1; 
    let imageScaleY = 1;
    let originalImageWidth = 0;
    let originalImageHeight = 0;

    copySelectedTextButton.disabled = true;
    console.log("OCR Word Selector script loaded."); // Log script load

    imageUpload.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        console.log("Image selected:", file.name);
        statusMessages.textContent = '正在上传和处理图像...';
        statusMessages.className = ''; 
        ocrImage.src = '#'; 
        ocrImage.style.display = 'none'; 
        selectionCanvas.style.display = 'none';
        ocrDataGlobal = [];
        clearSelection(); 
        copySelectedTextButton.disabled = true;
        selectedTextPreview.textContent = '-';

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData,
            });
            console.log("Upload response status:", response.status);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: '无法解析错误响应' }));
                console.error("Server error data:", errorData);
                throw new Error(`服务器错误: ${response.status} - ${errorData.error || '未知错误'}`);
            }

            const result = await response.json();
            console.log("Upload result:", result);

            if (result.success) {
                ocrImage.onload = () => {
                    console.log("ocrImage loaded successfully. Displayed width:", ocrImage.clientWidth, "height:", ocrImage.clientHeight);
                    selectionCanvas.width = ocrImage.clientWidth;
                    selectionCanvas.height = ocrImage.clientHeight;
                    ocrImage.style.display = 'block';
                    selectionCanvas.style.display = 'block';

                    originalImageWidth = result.imageWidth;
                    originalImageHeight = result.imageHeight;
                    imageScaleX = ocrImage.clientWidth / originalImageWidth;
                    imageScaleY = ocrImage.clientHeight / originalImageHeight;
                    console.log("Image scale factors:", imageScaleX, imageScaleY);
                    
                    statusMessages.textContent = `图像加载成功。识别到 ${result.ocrData.length} 个词语。`;
                    statusMessages.className = 'success';
                };
                ocrImage.onerror = () => {
                     console.error("Error loading processed image into <img> tag.");
                     statusMessages.textContent = '无法加载处理后的图像。';
                     statusMessages.className = 'error';
                }
                ocrImage.src = result.imageUrl; 
                ocrDataGlobal = result.ocrData; 
                console.log("OCR data received:", ocrDataGlobal.length, "words");
                
            } else {
                throw new Error(result.error || 'OCR处理失败。');
            }
        } catch (error) {
            console.error('上传/OCR错误:', error);
            statusMessages.textContent = `错误: ${error.message}`;
            statusMessages.className = 'error';
            ocrImage.style.display = 'block'; 
            ocrImage.src = '#';
        }
    });

    function getMousePos(canvas, evt) {
        const rect = canvas.getBoundingClientRect();
        const pos = {
            x: evt.clientX - rect.left,
            y: evt.clientY - rect.top
        };
        // console.log("Mouse position on canvas:", pos); // Can be too verbose
        return pos;
    }
    
    function doRectsOverlap(rect1, rect2) {
        const overlap = !(rect1.x + rect1.width < rect2.x ||
                          rect1.x > rect2.x + rect2.width ||
                          rect1.y + rect1.height < rect2.y ||
                          rect1.y > rect2.y + rect2.height);
        // if (overlap) console.log("Rects overlap:", rect1, rect2); // Can be verbose
        return overlap;
    }

    selectionCanvas.addEventListener('mousedown', (event) => {
        if (!ocrDataGlobal.length) return; 
        selectionStartPoint = getMousePos(selectionCanvas, event);
        console.log("Mousedown at:", selectionStartPoint);
        currentSelectionRect = null; 
        selectedWordIndices = []; 
        clearCanvas(); 
        event.preventDefault(); 
    });

    selectionCanvas.addEventListener('mousemove', (event) => {
        if (!selectionStartPoint || !ocrDataGlobal.length) return;
        
        // Added event.preventDefault() here for touchpad compatibility
        event.preventDefault(); 

        const currentMousePos = getMousePos(selectionCanvas, event);
        const x = Math.min(selectionStartPoint.x, currentMousePos.x);
        const y = Math.min(selectionStartPoint.y, currentMousePos.y);
        const width = Math.abs(selectionStartPoint.x - currentMousePos.x);
        const height = Math.abs(selectionStartPoint.y - currentMousePos.y);
        currentSelectionRect = { x, y, width, height };
        // console.log("Mousemove, currentSelectionRect:", currentSelectionRect); // Can be too verbose

        selectedWordIndices = [];
        ocrDataGlobal.forEach(wordInfo => { 
            const scaledBox = { 
                x: wordInfo.box[0] * imageScaleX,
                y: wordInfo.box[1] * imageScaleY,
                width: wordInfo.box[2] * imageScaleX,
                height: wordInfo.box[3] * imageScaleY
            };
            if (doRectsOverlap(currentSelectionRect, scaledBox)) {
                selectedWordIndices.push(wordInfo.global_index); 
            }
        });
        
        if (selectedWordIndices.length > 0) {
            // console.log("Words selected during mousemove:", selectedWordIndices.length);
        }
        selectedWordIndices.sort((a, b) => a - b); 
        drawHighlights(); 
    });

    selectionCanvas.addEventListener('mouseup', (event) => {
        if (!selectionStartPoint) return;
        console.log("Mouseup event. Final selected word indices:", selectedWordIndices);
        selectionStartPoint = null; 
        updateSelectedTextPreviewAndButton(); 
    });
    
    selectionCanvas.addEventListener('mouseleave', (event) => {
        if (selectionStartPoint) { 
            console.log("Mouseleave event during selection. Final selected word indices:", selectedWordIndices);
            selectionStartPoint = null;
            updateSelectedTextPreviewAndButton();
        }
    });

    function clearCanvas() {
        console.log("Clearing canvas.");
        ctx.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);
    }

    function drawHighlights() {
        clearCanvas(); 
        if (!selectedWordIndices.length) {
            // console.log("drawHighlights called, but no words selected.");
            return; 
        }
        console.log("drawHighlights called. Selected words count:", selectedWordIndices.length);

        const selectionColor = "rgba(215, 0, 68, 0.95)"; 
        ctx.fillStyle = selectionColor;

        const lineGroups = {}; 
        selectedWordIndices.forEach(globalIndex => {
            const wordInfo = ocrDataGlobal.find(w => w.global_index === globalIndex);
            if (wordInfo) { 
                if (!lineGroups[wordInfo.line_index]) {
                    lineGroups[wordInfo.line_index] = [];
                }
                lineGroups[wordInfo.line_index].push(wordInfo);
            }
        });
        console.log("Line groups for highlighting:", lineGroups);

        for (const lineIdx in lineGroups) {
            const wordsInLine = lineGroups[lineIdx];
            if (!wordsInLine.length) continue;

            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            
            wordsInLine.forEach(wordInfo => {
                const scaledBoxX = wordInfo.box[0] * imageScaleX;
                const scaledBoxY = wordInfo.box[1] * imageScaleY;
                const scaledBoxWidth = wordInfo.box[2] * imageScaleX;  
                const scaledBoxHeight = wordInfo.box[3] * imageScaleY;

                minX = Math.min(minX, scaledBoxX);
                maxX = Math.max(maxX, scaledBoxX + scaledBoxWidth); 
                minY = Math.min(minY, scaledBoxY);                 
                maxY = Math.max(maxY, scaledBoxY + scaledBoxHeight); 
            });
            if (minX !== Infinity) { 
                 console.log(`Drawing highlight for line ${lineIdx}:`, {minX, minY, width: maxX - minX, height: maxY - minY});
                 ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
            } else {
                 console.log(`Skipping highlight for line ${lineIdx} due to invalid coordinates.`);
            }
        }
    }
    
    function updateSelectedTextPreviewAndButton() {
        if (selectedWordIndices.length > 0) {
            let text = "";
            const sortedIndices = [...selectedWordIndices].sort((a, b) => a - b);
            sortedIndices.forEach(globalIndex => {
                const wordInfo = ocrDataGlobal.find(w => w.global_index === globalIndex);
                if (wordInfo) {
                    text += wordInfo.word + " "; 
                }
            });
            text = text.trim(); 
            selectedTextPreview.textContent = text.substring(0, 50) + (text.length > 50 ? '...' : '');
            copySelectedTextButton.disabled = false;
        } else {
            selectedTextPreview.textContent = '-';
            copySelectedTextButton.disabled = true;
        }
        console.log("Updated text preview and button state. Selected text:", selectedTextPreview.textContent);
    }

    function clearSelection() {
        selectedWordIndices = [];
        selectionStartPoint = null;
        currentSelectionRect = null;
        clearCanvas();
        updateSelectedTextPreviewAndButton();
        console.log("Selection cleared.");
    }

    copySelectedTextButton.addEventListener('click', () => {
        if (selectedWordIndices.length > 0) {
            let textToCopy = "";
            const sortedIndices = [...selectedWordIndices].sort((a,b) => a - b);
            sortedIndices.forEach(globalIndex => {
                const wordInfo = ocrDataGlobal.find(w => w.global_index === globalIndex);
                if (wordInfo) {
                    textToCopy += wordInfo.word + " "; 
                }
            });
            textToCopy = textToCopy.trim(); 
            console.log("Attempting to copy text:", textToCopy);

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(textToCopy).then(() => {
                    statusMessages.textContent = '已复制到剪贴板!';
                    statusMessages.className = 'success';
                    setTimeout(() => { statusMessages.textContent = ''; }, 2000);
                }).catch(err => {
                    statusMessages.textContent = '复制失败: ' + err;
                    statusMessages.className = 'error';
                    console.error('复制失败: ', err);
                    legacyCopyText(textToCopy);
                });
            } else {
                legacyCopyText(textToCopy);
            }
        }
    });

    function legacyCopyText(text) {
        console.log("Using legacy copy method.");
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed"; 
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            const successful = document.execCommand('copy');
            const msg = successful ? '已复制到剪贴板! (旧版)' : '复制失败 (旧版)';
            statusMessages.textContent = msg;
            statusMessages.className = successful ? 'success' : 'error';
            setTimeout(() => { statusMessages.textContent = ''; }, 2000);
        } catch (err) {
            statusMessages.textContent = '复制异常 (旧版): ' + err;
            statusMessages.className = 'error';
            console.error('复制异常 (旧版)', err);
        }
        document.body.removeChild(textArea);
    }

    document.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
            if (selectedWordIndices.length > 0 && document.activeElement !== imageUpload) {
                console.log("Ctrl+C / Cmd+C pressed, attempting to copy selected text.");
                copySelectedTextButton.click(); 
                event.preventDefault(); 
            }
        }
    });
});
