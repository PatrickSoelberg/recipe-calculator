from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from PIL import Image
import pytesseract
import io
import re
import json
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse
import cv2
import numpy as np

# Set Tesseract command path explicitly
pytesseract.pytesseract.tesseract_cmd = '/usr/bin/tesseract'

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://recipe-calculator-web.onrender.com",  # Add your frontend URL
        "https://recipe-calculator-api.onrender.com"   # Add your backend URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Ingredient(BaseModel):
    name: str
    amount: str
    unit: str

class RecipeResponse(BaseModel):
    ingredients: List[Ingredient]
    success: bool
    error: str = None

# Danish-specific corrections and mappings
DANISH_CORRECTIONS = {
    'ræsk': 'græsk',
    'yohurt': 'yoghurt',
    'hviøg': 'hvidløg',
    'kyllinebryst': 'kyllingebryst',
    'spisesked': 'spiseske',
    'tesked': 'teske',
    'stykher': 'stykker',
    'pakher': 'pakker',
    'daser': 'dåser',
    'dose': 'dåse',
    'hviøg': 'hvidløg',
    'øg': 'løg',
    'røøg': 'rødløg',
    'fed hviøg': 'fed hvidløg',
    # Add more corrections as needed
}

DANISH_UNITS = {
    'spsk': 'spiseske',
    'tsk': 'teske',
    'stk': 'stykker',
    'pk': 'pakke',
    'dl': 'deciliter',
    'g': 'gram',
    'kg': 'kilogram',
    'l': 'liter',
    'ml': 'milliliter',
    'cl': 'centiliter',
    'ds': 'dåse',
    'dåse': 'dåse',
    # Add more units as needed
}

def preprocess_image(image: Image.Image) -> Image.Image:
    """
    Preprocess image to improve OCR accuracy
    """
    # Convert PIL Image to OpenCV format
    opencv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    
    # Convert to grayscale
    gray = cv2.cvtColor(opencv_image, cv2.COLOR_BGR2GRAY)
    
    # Apply thresholding to get black and white image
    _, binary = cv2.threshold(gray, 128, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    # Remove noise
    denoised = cv2.fastNlMeansDenoising(binary)
    
    # Convert back to PIL Image
    return Image.fromarray(denoised)

def clean_danish_text(text: str) -> str:
    """
    Clean and normalize Danish text, correcting common OCR mistakes
    """
    # Normalize text encoding
    text = text.encode('utf-8', errors='ignore').decode('utf-8')
    
    # Convert to lowercase and strip whitespace
    text = text.lower().strip()
    
    # Apply corrections
    words = text.split()
    for i, word in enumerate(words):
        # Check for corrections
        if word in DANISH_CORRECTIONS:
            words[i] = DANISH_CORRECTIONS[word]
        
        # Expand unit abbreviations
        if word in DANISH_UNITS:
            words[i] = DANISH_UNITS[word]
    
    return ' '.join(words)

def preserve_special_chars(text: str) -> str:
    """
    Preserve special characters and handle common OCR issues
    """
    # Replace common problematic character sequences
    text = text.replace('æ', 'ae').replace('ø', 'oe').replace('å', 'aa')
    text = text.replace('Æ', 'Ae').replace('Ø', 'Oe').replace('Å', 'Aa')
    
    # Handle special cases for 'l' character
    words = text.split()
    for i, word in enumerate(words):
        # If it's a standalone 'l' after a number, it's likely a unit
        if word == 'l' and i > 0 and words[i-1].replace(',', '').replace('.', '').isdigit():
            continue
        # Replace 'l' with 'L' in other cases to preserve it
        if 'l' in word:
            words[i] = word.replace('l', 'L')
    
    return ' '.join(words)

def parse_ingredient_text(text: str) -> Optional[Ingredient]:
    """
    Parse ingredient text into structured data
    """
    # Clean and normalize text
    text = clean_danish_text(text)
    
    # Define units pattern including expanded forms
    units_pattern = r'({}|{})'.format(
        '|'.join(DANISH_UNITS.keys()),
        '|'.join(DANISH_UNITS.values())
    )
    
    # Look for number followed by optional unit
    number_match = re.search(r'\d+(?:[.,]\d+)?', text)
    unit_match = re.search(units_pattern, text, re.IGNORECASE)
    
    if number_match:
        amount = number_match.group()
        unit = unit_match.group() if unit_match else ''
        
        # Get the standardized form of the unit if it exists
        if unit.lower() in DANISH_UNITS:
            unit = DANISH_UNITS[unit.lower()]
        
        # Extract name by removing amount and unit
        name = text
        if unit:
            name = re.sub(f'{amount}|{unit}', '', name, flags=re.IGNORECASE)
        else:
            name = re.sub(f'{amount}', '', name)
        
        name = name.strip(' ,-')
        
        if name:  # Only return if we found a name
            return Ingredient(
                name=name,
                amount=amount,
                unit=unit
            )
    return None

def parse_ingredients_from_text(text: str) -> List[Ingredient]:
    """
    Parse multiple ingredients from text
    """
    lines = text.split('\n')
    ingredients = []
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Skip long lines (likely instructions)
        if len(line.split()) > 8:
            continue
        
        parsed = parse_ingredient_text(line)
        if parsed:
            ingredients.append(parsed)
    
    return ingredients

def extract_recipe_data(url: str) -> List[Ingredient]:
    """
    Extract recipe data from URL
    """
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept-Charset': 'utf-8'
        }
        
        response = requests.get(url, headers=headers)
        response.encoding = response.apparent_encoding
        
        soup = BeautifulSoup(response.text, 'html.parser', from_encoding='utf-8')
        
        # Try different methods to find ingredients
        ingredients = []
        
        # Method 1: Try to find JSON-LD structured data
        script_tags = soup.find_all('script', {'type': 'application/ld+json'})
        for script in script_tags:
            try:
                data = json.loads(script.string)
                if isinstance(data, dict) and '@type' in data and data['@type'] == 'Recipe':
                    ingredients = parse_jsonld_ingredients(data)
                    if ingredients:
                        return ingredients
            except (json.JSONDecodeError, AttributeError):
                continue
        
        # Method 2: Look for common recipe ingredient patterns
        ingredient_elements = find_ingredient_elements(soup)
        if ingredient_elements:
            ingredients = parse_html_ingredients(ingredient_elements)
            if ingredients:
                return ingredients
        
        # Method 3: Fall back to generic list parsing
        ingredients = parse_generic_lists(soup)
        
        return ingredients
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse recipe: {str(e)}")

def parse_jsonld_ingredients(data: dict) -> List[Ingredient]:
    """
    Parse ingredients from JSON-LD data
    """
    ingredients = []
    raw_ingredients = data.get('recipeIngredient', [])
    
    for raw in raw_ingredients:
        parsed = parse_ingredient_text(raw)
        if parsed:
            ingredients.append(parsed)
    
    return ingredients

def find_ingredient_elements(soup: BeautifulSoup) -> List[str]:
    """
    Find ingredient elements in HTML using common selectors
    """
    possible_selectors = [
        '.recipe-ingredients',
        '.ingredients-list',
        '.ingredient-list',
        '.ingredients',
        '[itemprop="recipeIngredient"]',
        '.recipe__ingredients',
        '.opskrift-ingredienser',
        '.ingredient-group',
        '.recipe-ingredients__list',
        '.ingredienser',
        # Add more selectors as needed
    ]
    
    for selector in possible_selectors:
        elements = soup.select(selector)
        if elements:
            return elements
    
    return []

def parse_html_ingredients(elements: List[str]) -> List[Ingredient]:
    """
    Parse ingredients from HTML elements
    """
    ingredients = []
    for element in elements:
        items = element.find_all('li') or [element]
        for item in items:
            text = item.get_text(strip=True)
            parsed = parse_ingredient_text(text)
            if parsed:
                ingredients.append(parsed)
    
    return ingredients

def parse_generic_lists(soup: BeautifulSoup) -> List[Ingredient]:
    """
    Parse ingredients from generic list items
    """
    ingredients = []
    for list_item in soup.find_all('li'):
        text = list_item.get_text(strip=True)
        parsed = parse_ingredient_text(text)
        if parsed:
            ingredients.append(parsed)
    
    return ingredients

@app.post("/parse-image", response_model=RecipeResponse)
async def parse_image(file: UploadFile = File(...)):
    """
    Parse ingredients from an uploaded image
    """
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        
        # Preprocess the image
        processed_image = preprocess_image(image)
        
        # Configure Tesseract for better accuracy
        custom_config = r'--oem 3 --psm 6 -c preserve_interword_spaces=1'
        extracted_text = pytesseract.image_to_string(
            processed_image,
            lang='dan',
            config=custom_config
        )
        
        # Parse ingredients from the extracted text
        ingredients = parse_ingredients_from_text(extracted_text)
        
        if not ingredients:
            return RecipeResponse(
                ingredients=[],
                success=False,
                error="Kunne ikke finde ingredienser i billedet"
            )
        
        return RecipeResponse(
            ingredients=ingredients,
            success=True
        )
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/parse-url", response_model=RecipeResponse)
async def parse_url(url: str = Query(...)):
    """
    Parse ingredients from a recipe URL
    """
    try:
        ingredients = extract_recipe_data(url)
        
        if not ingredients:
            return RecipeResponse(
                ingredients=[],
                success=False,
                error="Kunne ikke finde ingredienser på siden"
            )
        
        return RecipeResponse(
            ingredients=ingredients,
            success=True
        )
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))