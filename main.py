from fastapi import FastAPI
from pydantic import BaseModel
from transformers import DistilBertForSequenceClassification, DistilBertTokenizer
import torch
import torch.nn.functional as F

app = FastAPI(title="Harmful Content Detection API")

# 1. Load Model (Assuming model files are in the 'model' folder)
MODEL_PATH = "./model"
tokenizer = DistilBertTokenizer.from_pretrained(MODEL_PATH)
model = DistilBertForSequenceClassification.from_pretrained(MODEL_PATH)
model.eval()

# 2. Define the Input Schema
class PostInput(BaseModel):
    text: str

# 3. Define the API Endpoint
@app.post("/analyze")
def analyze_post(post: PostInput):
    # Tokenize
    inputs = tokenizer(post.text, return_tensors="pt", truncation=True, padding=True, max_length=128)
    
    # Predict
    with torch.no_grad():
        outputs = model(**inputs)
    
    probs = F.softmax(outputs.logits, dim=-1)[0]
    pred_idx = torch.argmax(probs).item()
    
    labels = {0: "Awareness", 1: "Glorification", 2: "Participation"}
    predicted_label = labels[pred_idx]
    confidence = probs[pred_idx].item() * 100
    
    # Determine Risk Level for the Dashboard
    risk_level = "Low"
    if predicted_label == "Glorification":
        risk_level = "High"
    elif predicted_label == "Participation":
        risk_level = "Medium"

    return {
        "text": post.text,
        "intent": predicted_label,
        "confidence": round(confidence, 2),
        "risk_level": risk_level,
        "alert_message": f"Warning: This post contains {predicted_label} intent."
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
