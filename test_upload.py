#!/usr/bin/env python3
"""
测试上传功能的脚本
"""
import requests
import json

def test_upload():
    """测试图片上传功能"""
    url = "http://localhost:5001/upload"
    
    # 使用test.png文件进行测试
    with open('test.png', 'rb') as f:
        files = {'file': ('test.png', f, 'image/png')}
        
        try:
            response = requests.post(url, files=files)
            print(f"状态码: {response.status_code}")
            print(f"响应头: {response.headers}")
            
            if response.status_code == 200:
                result = response.json()
                print(f"响应内容: {json.dumps(result, indent=2, ensure_ascii=False)}")
            else:
                print(f"错误响应: {response.text}")
                
        except Exception as e:
            print(f"请求失败: {e}")

if __name__ == "__main__":
    test_upload() 