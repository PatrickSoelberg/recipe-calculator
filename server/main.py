from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from PIL import Image
import pytesseract
import io
import re
import json
import os
import requests
import logging
import subprocess
from bs4 import BeautifulSoup
from urllib.parse import urlparse
import cv2
import numpy as np

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Pydantic models
class Ingredient(BaseModel):
    name: str
    amount: str
    unit: str

class RecipeResponse(BaseModel):
    ingredients: List[Ingredient]
    success: bool
    recipeName: Optional[str] = None  # Added recipe name field
    error: Optional[str] = None

# Enhanced Danish-specific corrections and mappings
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
    'øg': 'løg',
    'røøg': 'rødløg',
    'fed hviøg': 'fed hvidløg',
    'citroner': 'citron',
    'kartofier': 'kartofler',
    'guierod': 'gulerod',
    'guierødder': 'gulerødder',
    'tomatcr': 'tomater',
    'basilikuni': 'basilikum',
    'persilje': 'persille',
    # Add more corrections as needed
}

# CRITICAL: Proper Danish units - do NOT convert special units
DANISH_UNITS = {
    # Standard abbreviations that should be expanded
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
    # DO NOT include special units like 'fed', 'håndfuld' here!
}

# Special Danish units that should NEVER be converted
SPECIAL_DANISH_UNITS = {
    'fed', 'håndfuld', 'håndfulde', 'knivspids', 'pind', 'pose', 'bundt', 
    'bundle', 'neve', 'klat', 'skive', 'klump'
}

# More conservative ingredient core mapping - only very specific cases
INGREDIENT_CORE_MAPPING = {
    'hvidløg': ['hvidløgsfed'],  # Only map very specific variations
    'persille': ['bredbladet persille', 'bladpersille'],
    'basilikum': ['frisk basilikum'],
    'tomater': ['hakkede tomater', 'cherry tomater', 'cocktail tomater']
}

# Words that should never be considered ingredients
NON_INGREDIENT_WORDS = {
    'styrke', 'mere', 'mindre', 'efter', 'smag', 'behov', 'ønske', 'cirka', 'ca',
    'evt', 'eventuelt', 'til', 'som', 'eller', 'og', 'af', 'med', 'uden', 'for',
    'servering', 'pynt', 'garnering', 'side', 'ekstra', 'let', 'god', 'fin', 'stor', 'lille'
}

# Find Tesseract executable by checking common locations
tesseract_cmd = 'tesseract'  # Default to just the command name
for path in ['/usr/bin/tesseract', '/usr/local/bin/tesseract', 'tesseract']:
    try:
        subprocess.run([path, '--version'], capture_output=True, check=True)
        tesseract_cmd = path
        break
    except (subprocess.SubprocessError, FileNotFoundError):
        continue

# Configure pytesseract
pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

# Create FastAPI app
app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://recipe-calculator-web.onrender.com",
        "https://recipe-calculator-api.onrender.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
        
        # Expand unit abbreviations ONLY for standard units
        if word in DANISH_UNITS:
            words[i] = DANISH_UNITS[word]
    
    return ' '.join(words)

def clean_ingredient_name(raw_name: str) -> str:
    """
    More conservative ingredient name cleaning
    """
    clean_name = raw_name.lower().strip()
    
    # Only remove very specific instruction patterns
    specific_patterns = [
        r',?\s*(saft og .*skal.*)',     # "saft og fintrevet skal heraf"
        r',?\s*(kun saften)',           # "kun saften"
        r'\(.*?\)',                     # Remove parenthetical content
    ]
    
    for pattern in specific_patterns:
        clean_name = re.sub(pattern, '', clean_name, flags=re.IGNORECASE)
    
    # Only remove clear preparation terms, not descriptive words
    prep_terms = [
        'finthakkede', 'fintrevet', 'hakket', 'finsnittet', 'opskåret', 'skårne', 'skåret',
        'delte', 'opdelte', 'smuldret', 'fintsnittet', 'groftrevet', 'kogte', 'ristede',
        'sautéede', 'opvarmede', 'grillede', 'stegte', 'blancherede', 'røget',
        'skrællede', 'rensede', 'pressede', 'finthakket', 'grofthakket'
    ]
    
    prep_pattern = r'\b(' + '|'.join(prep_terms) + r')\b'
    clean_name = re.sub(prep_pattern, '', clean_name, flags=re.IGNORECASE)
    
    # Clean up punctuation and spaces
    clean_name = re.sub(r'[,.-]+$', '', clean_name)  # Remove trailing punctuation
    clean_name = re.sub(r'^[,.-]+', '', clean_name)  # Remove leading punctuation
    clean_name = re.sub(r'\s+', ' ', clean_name)     # Normalize spaces
    clean_name = clean_name.strip()
    
    # Check if it's a non-ingredient word
    if clean_name in NON_INGREDIENT_WORDS:
        return None  # Don't return non-ingredients
    
    # Only map very specific cases, preserve most original names
    for core_ingredient, variations in INGREDIENT_CORE_MAPPING.items():
        if clean_name in variations:
            return core_ingredient
    
    # Return the cleaned name as-is (don't extract "last word")
    return clean_name if clean_name else None

def normalize_unit(unit: str) -> str:
    """
    Normalize unit but preserve special Danish units
    """
    if not unit:
        return ''
    
    unit_lower = unit.lower().strip()
    
    # CRITICAL: Never convert special Danish units
    if unit_lower in SPECIAL_DANISH_UNITS:
        return unit_lower
    
    # Only convert standard abbreviations
    return DANISH_UNITS.get(unit_lower, unit_lower)

def parse_ingredient_text(text: str) -> Optional[Ingredient]:
    """
    Enhanced ingredient parsing that preserves special Danish units
    """
    text = text.strip()
    if not text:
        return None
    
    # Extract amount (handle fractions, ranges, and question marks)
    amount_pattern = r'^(\d+(?:[.,/]\d+)?(?:\s*-\s*\d+(?:[.,/]\d+)?)?|\?|\d+\s*½|\d+\s*¼|\d+\s*¾|½|¼|¾)'
    amount_match = re.search(amount_pattern, text)
    
    amount = '?'
    remaining_text = text
    
    if amount_match:
        amount = amount_match.group(1)
        remaining_text = text[amount_match.end():].strip()
    
    # Extract unit - be very careful with special units
    all_units = list(DANISH_UNITS.keys()) + list(DANISH_UNITS.values()) + list(SPECIAL_DANISH_UNITS)
    # Sort by length descending to match longer units first (e.g., "håndfulde" before "håndfuld")
    unit_pattern = r'^(' + '|'.join(sorted(all_units, key=len, reverse=True)) + r')\b'
    unit_match = re.search(unit_pattern, remaining_text, re.IGNORECASE)
    
    unit = ''
    ingredient_text = remaining_text
    
    if unit_match:
        unit = normalize_unit(unit_match.group(1))
        ingredient_text = remaining_text[unit_match.end():].strip()
    
    # Clean the ingredient name
    ingredient_name = clean_ingredient_name(ingredient_text)
    
    if not ingredient_name:
        return None
    
    return Ingredient(
        name=ingredient_name,
        amount=amount,
        unit=unit
    )

def parse_ingredients_from_text(text: str) -> List[Ingredient]:
    """
    Parse multiple ingredients from text with improved cleaning
    """
    lines = text.split('\n')
    ingredients = []
    
    for line in lines:
        line = line.strip()
        if not line or len(line) < 3:
            continue
        
        # Skip lines that are clearly instructions (too long or contain instruction words)
        instruction_indicators = ['bland', 'tilsæt', 'hæld', 'kog', 'steg', 'varm', 'server', 'rør', 'kom']
        if (len(line.split()) > 10 or 
            any(indicator in line.lower() for indicator in instruction_indicators)):
            continue
        
        parsed = parse_ingredient_text(line)
        if parsed and parsed.name:  # Only add if we have a valid name
            ingredients.append(parsed)
    
    # Deduplicate ingredients by name and unit
    unique_ingredients = []
    seen = set()
    
    for ingredient in ingredients:
        key = f"{ingredient.name.lower()}_{ingredient.unit.lower()}"
        if key not in seen:
            seen.add(key)
            unique_ingredients.append(ingredient)
        else:
            logger.info(f"Skipping duplicate ingredient: {ingredient.name} ({ingredient.unit})")
    
    return unique_ingredients

def extract_recipe_title(soup: BeautifulSoup) -> Optional[str]:
    """
    Extract recipe title from HTML using multiple strategies
    """
    # Strategy 1: Look for JSON-LD structured data first
    script_tags = soup.find_all('script', {'type': 'application/ld+json'})
    for script in script_tags:
        try:
            data = json.loads(script.string)
            if isinstance(data, dict) and '@type' in data and data['@type'] == 'Recipe':
                title = data.get('name')
                if title and isinstance(title, str) and len(title.strip()) > 3:
                    return title.strip()
        except (json.JSONDecodeError, AttributeError):
            continue
    
    # Strategy 2: Look for recipe-specific title selectors
    recipe_title_selectors = [
        '.recipe-title',
        '.recipe-header h1',
        '.recipe-name',
        '.entry-title',
        '.post-title',
        '.recipe__title',
        '.wprm-recipe-name',
        '.opskrift-titel',
        'h1.recipe',
        '[itemprop="name"]'
    ]
    
    for selector in recipe_title_selectors:
        elements = soup.select(selector)
        for element in elements:
            title = element.get_text(strip=True)
            if title and len(title) > 3 and len(title) < 200:  # Reasonable title length
                # Clean the title
                title = re.sub(r'\s+', ' ', title)  # Normalize whitespace
                title = title.strip()
                if title:
                    logger.info(f"Found recipe title using selector '{selector}': {title}")
                    return title
    
    # Strategy 3: Look for the main h1 tag, but be selective
    h1_elements = soup.find_all('h1')
    for h1 in h1_elements:
        title = h1.get_text(strip=True)
        if title and len(title) > 3 and len(title) < 200:
            # Skip common non-recipe titles
            skip_keywords = ['home', 'menu', 'blog', 'about', 'contact', 'search', 'kategori', 'arkiv']
            if not any(keyword in title.lower() for keyword in skip_keywords):
                logger.info(f"Found recipe title from h1: {title}")
                return title
    
    # Strategy 4: Use page title as last resort, but clean it up
    title_tag = soup.find('title')
    if title_tag:
        title = title_tag.get_text(strip=True)
        if title and len(title) > 3:
            # Clean up common title patterns
            title = re.sub(r'\s*[-|–]\s*.*$', '', title)  # Remove " - Site Name" parts
            title = re.sub(r'\s*\|\s*.*$', '', title)     # Remove " | Site Name" parts
            title = title.strip()
            if len(title) > 3 and len(title) < 200:
                logger.info(f"Using cleaned page title: {title}")
                return title
    
    logger.info("Could not find recipe title")
    return None

def extract_recipe_data(url: str) -> tuple[List[Ingredient], Optional[str]]:
    """
    Extract recipe data and title from URL
    Returns: (ingredients, recipe_title)
    """
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept-Charset': 'utf-8'
        }
        
        response = requests.get(url, headers=headers)
        response.encoding = response.apparent_encoding
        
        soup = BeautifulSoup(response.text, 'html.parser', from_encoding='utf-8')
        
        # Extract recipe title first
        recipe_title = extract_recipe_title(soup)
        
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
                        return ingredients, recipe_title
            except (json.JSONDecodeError, AttributeError):
                continue
        
        # Method 2: Look for common recipe ingredient patterns  
        ingredient_elements = find_ingredient_elements(soup)
        if ingredient_elements:
            ingredients = parse_html_ingredients(ingredient_elements)
            if ingredients:
                return ingredients, recipe_title
        
        # Method 3: Fall back to generic list parsing
        ingredients = parse_generic_lists(soup)
        
        return ingredients, recipe_title
        
    except Exception as e:
        logger.error(f"Error extracting recipe data: {str(e)}")
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

def find_ingredient_elements(soup: BeautifulSoup) -> List:
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
        # WP Recipe Maker specific selectors
        '.wprm-recipe-ingredient',
        '.wprm-recipe-ingredients',
        # Add more selectors as needed
    ]
    
    for selector in possible_selectors:
        elements = soup.select(selector)
        if elements:
            logger.info(f"Found ingredients using selector: {selector}")
            return elements
    
    return []

def parse_html_ingredients(elements: List) -> List[Ingredient]:
    """
    Parse ingredients from HTML elements
    """
    ingredients = []
    for element in elements:
        # Handle both list items and direct text content
        if element.find_all('li'):
            items = element.find_all('li')
        else:
            items = [element]
            
        for item in items:
            text = item.get_text(strip=True)
            if text and len(text) > 2:  # Skip very short texts
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
        if text and len(text) > 2:  # Skip very short texts
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
            success=True,
            recipeName=None  # No recipe name from images
        )
        
    except Exception as e:
        logger.error(f"Error processing image: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/parse-url", response_model=RecipeResponse)
async def parse_url(url: str = Query(...)):
    """
    Parse ingredients and recipe name from a recipe URL
    """
    try:
        ingredients, recipe_title = extract_recipe_data(url)
        
        if not ingredients:
            return RecipeResponse(
                ingredients=[],
                success=False,
                recipeName=recipe_title,  # Still return title even if no ingredients
                error="Kunne ikke finde ingredienser på siden"
            )
        
        return RecipeResponse(
            ingredients=ingredients,
            recipeName=recipe_title,  # Include the extracted recipe title
            success=True
        )
        
    except Exception as e:
        logger.error(f"Error processing URL: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

# Test endpoint for debugging
@app.get("/test-parsing")
async def test_parsing():
    """
    Test endpoint to verify parsing logic
    """
    test_ingredients = [
        "6 fed hvidløg",
        "2 håndfulde bredbladet persille, finthakket",
        "1/2 citron, saft og fintrevet skal heraf",
        "3 store kartofler, skrællede og skåret i kvarte",
        "1 tsk salt",
        "2 dl mælk",
        "500 g pasta",
        "1 chili",
        "styrke",
        "mere"
    ]
    
    results = []
    for ingredient_text in test_ingredients:
        parsed = parse_ingredient_text(ingredient_text)
        results.append({
            "original": ingredient_text,
            "parsed": parsed.dict() if parsed else None
        })
    
    return {"test_results": results}

# Test endpoint for title extraction
@app.get("/test-title")
async def test_title_extraction(url: str = Query(...)):
    """
    Test endpoint to verify title extraction
    """
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        title = extract_recipe_title(soup)
        
        return {
            "url": url,
            "extracted_title": title,
            "page_title": soup.find('title').get_text(strip=True) if soup.find('title') else None
        }
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)