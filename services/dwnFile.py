import requests

with open('cookies.txt', 'rb') as f:
    files = {'file': f}
    response = requests.post('http://prem-eu4.bot-hosting.net:20459/upload-cookies', files=files)
    print(response.json())
