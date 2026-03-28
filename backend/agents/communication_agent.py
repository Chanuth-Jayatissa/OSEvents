import os
import requests
from google import genai
from dotenv import load_dotenv

load_dotenv()

# env variables
api_key = os.getenv("API_KEY")
model = os.getenv("MODEL")

# init model
client = genai.Client(api_key=api_key)

#==============================
#           TOOLS
#==============================

def create_server():
    pass

# 1. Define the Discord Tool
def create_discord_server(server_name: str, api_keys: dict) -> str:
    """
    Creates a new Discord server (guild) using a bot token.
    
    Args:
        server_name: The name for the new Discord server.
        api_keys: A dictionary containing 'discord_bot_token'.
    """
    token = api_keys.get("discord_bot_token")
    if not token:
        return "Error: No 'discord_bot_token' found in the provided API keys."

    url = "https://discord.com/api/v10/guilds"
    headers = {
        "Authorization": f"Bot {token}",
        "Content-Type": "application/json"
    }
    payload = {
        "name": server_name
    }

    try:
        response = requests.post(url, headers=headers, json=payload)
        
        if response.status_code == 201:
            data = response.json()
            return f"Success! Created server '{data['name']}' with ID: {data['id']}"
        else:
            return f"Failed to create server. Status Code: {response.status_code}, Response: {response.text}"
            
    except Exception as e:
        return f"An error occurred: {str(e)}"

def message_user():
    pass

def generate_email(sender: str, to: str, cc: list, bcc: list):
    pass

# 1. Define your Python functions (Tools)
# Note: Type hints and docstrings are REQUIRED as Gemini uses them to understand the tool.
# def get_server_status(server_id: str) -> str:
#     """
#     Checks the current status of a specific server.
    
#     Args:
#         server_id: The unique identifier for the server (e.g., 'SRV-101').
#     """
#     # In a real scenario, you would perform an API call or database lookup here.
#     server_data = {
#         "SRV-101": "Online - CPU Load: 12%",
#         "SRV-102": "Offline - Maintenance",
#         "SRV-500": "Online - CPU Load: 88%"
#     }
#     return server_data.get(server_id, "Unknown Server ID")


# 3. Create a chat session with the tools
# Automatic function calling is enabled by default in the google-genai SDK.
chat = client.chats.create(
    model=model, # You can also use 'gemini-3-flash'
    config={
        'tools': [

        ]
    }
)

# 4. Ask a question that requires the tool
prompt = ""
# The SDK detects Gemini wants to call 'get_server_status', 
# executes it, and returns the final natural language answer.
response = chat.send_message(prompt)

print(f"Gemini: {response.text}")