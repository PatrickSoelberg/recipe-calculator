import React, { useState } from 'react';
import { Upload, Link, Users, Plus, Trash2, X } from 'lucide-react';

// Configuration for API
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Enhanced unit categories with proper Danish units
const DANISH_UNIT_CATEGORIES = {
  volume: ['liter', 'deciliter', 'centiliter', 'milliliter', 'l', 'dl', 'cl', 'ml'],
  weight: ['kilogram', 'gram', 'kg', 'g'],
  pieces: ['stykker', 'stk', 'pakke', 'pk', 'dåse', 'ds'],
  spoons: ['spiseske', 'teske', 'spsk', 'tsk'],
  // CRITICAL: Special Danish units that should NOT be converted
  special_danish: ['fed', 'håndfuld', 'håndfulde', 'knivspids', 'pind', 'pose', 'bundt', 'bundle', 'neve', 'klat', 'skive', 'klump']
};

// More targeted preparation terms - only clear preparation actions
const preparationTerms = [
  // Clear cutting/chopping actions
  'finthakkede', 'fintrevet', 'hakket', 'finsnittet', 'opskåret', 'skårne', 'skåret', 
  'delte', 'opdelte', 'smuldret', 'fintsnittet', 'groftrevet',
  
  // Clear cooking states
  'kogte', 'ristede', 'sautéede', 'opvarmede', 'grillede', 'stegte', 'blancherede', 'røget',
  
  // Clear preparation states
  'skrællede', 'rensede', 'pressede',
  
  // Specific phrases to remove
  'finthakket', 'grofthakket'
];

// More conservative ingredient core mapping - only for very specific cases
const INGREDIENT_CORE_MAPPING = {
  // Only map very specific variations that are clearly the same ingredient
  'hvidløg': ['hvidløgsfed'], // Don't map "hvidløg" itself
  'persille': ['bredbladet persille', 'bladpersille'], // But not just "persille"
  'basilikum': ['frisk basilikum'],
  'tomater': ['hakkede tomater', 'cherry tomater', 'cocktail tomater']
};

// Words that should never be considered ingredients - including vand, salt, peber
const NON_INGREDIENT_WORDS = new Set([
  'styrke', 'mere', 'mindre', 'efter', 'smag', 'behov', 'ønske', 'cirka', 'ca',
  'evt', 'eventuelt', 'til', 'som', 'eller', 'og', 'af', 'med', 'uden', 'for',
  'servering', 'pynt', 'garnering', 'side', 'ekstra', 'vand', 'salt', 'peber', 
  'salt og peber', 'friskkværnet peber', 'salt og friskkværnet peber'
]);

// Much more conservative ingredient name cleaning
const cleanIngredientName = (rawName) => {
  let cleanName = rawName.toLowerCase().trim();
  
  // Step 1: Only remove very specific instruction patterns
  const specificPatterns = [
    /,?\s*(saft og .*skal.*)/gi,     // "saft og fintrevet skal heraf"
    /,?\s*(kun saften)/gi,           // "kun saften"
    /\(.*?\)/gi,                     // Remove parenthetical content
  ];
  
  specificPatterns.forEach(pattern => {
    cleanName = cleanName.replace(pattern, '');
  });
  
  // Step 2: Only remove clear preparation terms, not descriptive words
  const prepRegex = new RegExp(`\\b(${preparationTerms.join('|')})\\b`, 'gi');
  cleanName = cleanName.replace(prepRegex, '');
  
  // Step 3: Clean up punctuation and extra spaces
  cleanName = cleanName
    .replace(/[,.-]+$/, '')          // Remove trailing punctuation
    .replace(/^[,.-]+/, '')          // Remove leading punctuation
    .replace(/\s+/g, ' ')            // Normalize spaces
    .trim();
  
  // Step 4: Check if it's a non-ingredient word
  if (NON_INGREDIENT_WORDS.has(cleanName)) {
    return null; // Don't return non-ingredients
  }
  
  // Step 5: Only map very specific cases, preserve most original names
  for (const [coreIngredient, variations] of Object.entries(INGREDIENT_CORE_MAPPING)) {
    if (variations.includes(cleanName)) {
      return coreIngredient;
    }
  }
  
  // Step 6: Return the cleaned name as-is (don't extract "last word")
  return cleanName || null;
};

// Fixed unit normalization - DO NOT convert special Danish units
const normalizeUnit = (unit) => {
  if (!unit) return '';
  
  const lowerUnit = unit.toLowerCase().trim();
  
  // CRITICAL: Preserve special Danish units exactly as they are
  if (DANISH_UNIT_CATEGORIES.special_danish.includes(lowerUnit)) {
    return lowerUnit;
  }
  
  // Standard unit conversions
  const unitMappings = {
    'spsk': 'spiseske',
    'tsk': 'teske',
    'stk': 'stykker',
    'pk': 'pakke',
    'ds': 'dåse',
    'g': 'gram',
    'kg': 'kilogram',
    'l': 'liter',
    'dl': 'deciliter',
    'cl': 'centiliter',
    'ml': 'milliliter'
  };
  
  return unitMappings[lowerUnit] || lowerUnit;
};

// Enhanced ingredient normalization that preserves measurement context
const normalizeIngredient = (ingredientName) => {
  return cleanIngredientName(ingredientName);
};

// Define food categories with keywords for categorization
const FOOD_CATEGORIES = {
  '🥩 Kød/Fisk': ['kød', 'bøf', 'bacon', 'laks', 'pighvar', 'kotelet', 'reje', 'hummer', 'okse', 'andebryst', 'kalvefilet', 'svinemørbrad', 'gravlaks', 'hellefisk', 'torskerogn', 'ål', 'rødspætte', 'gedde', 'lever', 'farsbrød', 'oksekød', 'kylling', 'carpaccio', 'filet', 'bisk', 'torsk', 'kyllingebryst', 'kyllingelår', 'fiskefrikadeller', 'entrecotes'],
  '🧀 Mejeri': ['mælk', 'smør', 'æg', 'cremefraiche', 'fløde', 'yoghurt', 'ost', 'frossen spinat', 'græsk yoghurt', 'gær', 'creme fraiche', 'blåskimmelost', 'havarti', 'danbo', 'brie', 'camembert', 'rygeost', 'kærnemælk', 'tykmælk', 'kondenseret mælk', 'flødeost', 'hytteost'],
  '🥫 Kolonial': ['mel', 'kokosmælk', 'stivelse', 'stødt', 'tørret', 'krydder', 'kerner', 'mandler', 'nødder', 'pure', 'hakkede tomat', 'tomatpuré', 'salt og peber', 'salt', 'peber', 'tahin', 'kikærter', 'cayenne', 'fivespice', 'plader', 'bouillon', 'bouillonterning', 'bouillonterning - kylling', 'vin', 'olie','laurbærblade', 'sød paprika', 'paprika', 'muskatnød','pasta', 'fennikelfrø', 'sukker', 'mayonnaise', 'sennep', 'ris', 'garam masala', 'chiliflager', 'bulgur', 'butterbeans', 'honning', 'fishsauce', 'cornichoner', 'tranebær', 'brød', 'burgerboller', 'bagepulver', 'vaniliesukker', 'flormelis', 'havregryn', 'valnødder', 'hasselnødder', 'pistacier', 'kokosmel', 'hoisinsauce', 'teriyakisauce', 'worcestershiresauce', 'sriracha', 'olivenolie', 'sesamolie', 'kokosolie', 'balsamicoeddike', 'hvidvinseddike', 'æbleeddike', 'kardemomme', 'safran', 'gurkemeje', 'kummenfro', 'rødvin', 'hvidvin', 'portvin', 'madeira', 'sherry'],
  '🥕 Grønt': ['kartofler', 'friskbælgede ærter', 'løg', 'spidskål', 'porre', 'asparges', 'ærtespirer', 'brøndkarse', 'hvidløg', 'salat', 'tomater', 'selleri', 'peberfrugt', 'champignon', 'agurk', 'squash', 'aubergine', 'gulerødder', 'persille', 'rødløg', 'basilikum', 'dild', 'æble', 'bønnespirer', 'lime', 'chili', 'citron', 'granatæble', 'pinjekerner', 'rucola', 'ingefær', 'koriander', 'blomkål', 'grønkål', 'rødkål', 'rosenkål', 'porrer', 'pastinak', 'knoldselleri', 'rødbeder', 'hindbær', 'jordbær', 'blåbær', 'æbler', 'pærer', 'rabarber', 'estragon', 'kørvel', 'purløg', 'rosmarin', 'salvie', 'oregano']
};

// Enhanced Danish number parsing that handles unknown amounts
const parseDanishNumber = (str) => {
  if (!str || str === '?') return '?';  // Handle unknown amounts
  
  // Handle fractions first
  if (str.includes('½')) {
    const baseMatch = str.match(/(\d+)?\s*½/);
    if (baseMatch) {
      const base = baseMatch[1] ? parseInt(baseMatch[1]) : 0;
      return base + 0.5;
    }
    return 0.5;
  }
  
  if (str.includes('¼')) {
    const baseMatch = str.match(/(\d+)?\s*¼/);
    if (baseMatch) {
      const base = baseMatch[1] ? parseInt(baseMatch[1]) : 0;
      return base + 0.25;
    }
    return 0.25;
  }
  
  if (str.includes('¾')) {
    const baseMatch = str.match(/(\d+)?\s*¾/);
    if (baseMatch) {
      const base = baseMatch[1] ? parseInt(baseMatch[1]) : 0;
      return base + 0.75;
    }
    return 0.75;
  }
  
  // Handle ranges (e.g., "2-3")
  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 2) {
      const start = parseFloat(parts[0].replace(',', '.'));
      const end = parseFloat(parts[1].replace(',', '.'));
      if (!isNaN(start) && !isNaN(end)) {
        return (start + end) / 2;
      }
    }
  }
  
  // Convert Danish decimal format (comma) to JavaScript format (period)
  const normalized = str.replace(',', '.');
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? '?' : parsed;  // Return '?' instead of 0 for invalid numbers
};

// Fixed number formatting that maintains appropriate precision
const formatDanishNumber = (num) => {
  if (num === 0) return '0';
  
  // For very small numbers, show more precision
  if (num < 1 && num > 0) {
    const str = num.toFixed(3);
    // Remove trailing zeros after decimal point only
    const trimmed = str.replace(/\.?0+$/, '');
    return trimmed.includes('.') ? trimmed.replace('.', ',') : trimmed + ',0';
  }
  
  // For larger numbers, use appropriate precision
  const decimalPlaces = num < 10 ? 2 : (num < 100 ? 1 : 0);
  const str = num.toFixed(decimalPlaces);
  
  // FIXED: Only remove trailing zeros after a decimal point, not from whole numbers
  const trimmed = str.replace(/\.0+$/, '');  // Only remove .0, .00, etc., not trailing zeros from whole numbers
  
  // Convert back to Danish format
  return trimmed.replace('.', ',');
};

// Function to initialize the days state with recipe arrays
const createInitialDays = () => {
  const weekdays = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag'];
  return weekdays.reduce((acc, day) => ({
    ...acc,
    [day]: { 
      adults: 0, 
      kids: 0, 
      teens: 0,
      recipes: [],
      successMessage: '' 
    }
  }), {});
};

const App = () => {
  const [activeTab, setActiveTab] = useState('Oversigt');
  const [loading, setLoading] = useState(false);
  const [recipeUrls, setRecipeUrls] = useState({
    'Mandag': '',
    'Tirsdag': '',
    'Onsdag': '',
    'Torsdag': '',
    'Fredag': ''
  });
  
  // Helper function to ensure recipes array exists (for backward compatibility)
  const ensureRecipesArray = (dayData) => {
    if (!dayData.recipes) {
      return { ...dayData, recipes: [] };
    }
    return dayData;
  };

  const [days, setDays] = useState(() => {
    const initialDays = createInitialDays();
    // Ensure all days have the recipes array
    Object.keys(initialDays).forEach(day => {
      initialDays[day] = { ...initialDays[day], recipes: initialDays[day].recipes || [] };
    });
    return initialDays;
  });

  // Calculate total people for a day (V + B/2 + O/2)
  const calculateTotalPeople = (adults, kids, teens) => {
    return adults + (kids / 2) + (teens / 2);
  };

  // Calculate tables needed (total people / 6, rounded up)
  const calculateTables = (adults, kids, teens) => {
    const totalPeople = adults + kids + teens;
    return Math.ceil(totalPeople / 6);
  };

  // Calculate cost for a day (without 15% deduction, excluding O - små børn)
  const calculateCost = (day, adults, kids, teens) => {
    const isFriday = day === 'Fredag';
    const pricePerAdult = isFriday ? 60 : 44;
    const pricePerChild = pricePerAdult / 2;
    
    // Only include adults and kids, exclude teens (små børn)
    return (adults * pricePerAdult) + (kids * pricePerChild);
  };

  // Calculate total cost for all days
  const calculateTotalCost = () => {
    return Object.entries(days).reduce((total, [dayName, dayData]) => {
      const cost = calculateCost(dayName, dayData.adults, dayData.kids, dayData.teens);
      return total + cost;
    }, 0);
  };

  // Calculate 15% of total (Basisvarer)
  const calculateBasisvarer = () => {
    const totalCost = calculateTotalCost();
    return totalCost * 0.15;
  };

  // Calculate amount for purchaser (Total - 15%)
  const calculateTilIndkøber = () => {
    const totalCost = calculateTotalCost();
    const basisvarer = calculateBasisvarer();
    return totalCost - basisvarer;
  };

  const updatePeople = (day, type, value) => {
    setDays(prev => ({
      ...prev,
      [day]: { ...prev[day], [type]: parseInt(value) || 0 }
    }));
  };

  const handleUrlSubmit = async (day, e) => {
    e.preventDefault();
    const url = recipeUrls[day];
    if (!url.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/parse-url?url=${encodeURIComponent(url)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (data.success) {
        const recipeName = data.recipeName || `Opskrift ${(days[day].recipes || []).length + 1}`;
        addNewRecipe(day, data.ingredients, 4, recipeName);
        setRecipeUrls(prev => ({ ...prev, [day]: '' }));
        setSuccessMessage(`✅ Ingredienser tilføjet til ${day}`, day);
      } else {
        setSuccessMessage(`❌ Kunne ikke finde ingredienser på siden for ${day}`, day);
      }
    } catch (error) {
      setSuccessMessage(`❌ Der opstod en fejl under behandling af URLen for ${day}`, day);
    } finally {
      setLoading(false);
    }
  };

  const setSuccessMessage = (message, day) => {
    setDays(prev => ({
      ...prev,
      [day]: { ...prev[day], successMessage: message }
    }));
    // Clear message after 5 seconds
    setTimeout(() => {
      setDays(prev => ({
        ...prev,
        [day]: { ...prev[day], successMessage: '' }
      }));
    }, 5000);
  };

  // Function to check if ingredient should be excluded
  const shouldExcludeIngredient = (ingredientName) => {
    const name = ingredientName.toLowerCase().trim();
    const excludedIngredients = ['vand', 'salt', 'peber', 'salt og peber', 'friskkværnet peber', 'salt og friskkværnet peber'];
    return excludedIngredients.includes(name) || NON_INGREDIENT_WORDS.has(name);
  };

  const addNewRecipe = (day, ingredients, servings = 4, recipeName = null) => {
    // Filter and normalize ingredients - remove invalid ones and excluded ingredients
    const normalizedIngredients = ingredients
      .map(ingredient => {
        const cleanedName = normalizeIngredient(ingredient.name);
        if (!cleanedName || shouldExcludeIngredient(cleanedName)) return null;
        
        return {
          ...ingredient,
          name: cleanedName,
          unit: normalizeUnit(ingredient.unit)
        };
      })
      .filter(ingredient => ingredient !== null); // Remove null entries

    // Deduplicate ingredients by name and unit
    const uniqueIngredients = [];
    const seen = new Set();
    
    for (const ingredient of normalizedIngredients) {
      const key = `${ingredient.name.toLowerCase()}_${ingredient.unit.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueIngredients.push(ingredient);
      }
    }

    // Create new recipe object
    const newRecipe = {
      id: Date.now(), // Simple ID generation
      ingredients: uniqueIngredients,
      servings: servings,
      name: recipeName || `Opskrift ${(days[day].recipes || []).length + 1}`
    };

    setDays(prev => ({
      ...prev,
      [day]: { 
        ...ensureRecipesArray(prev[day]), 
        recipes: [...(prev[day].recipes || []), newRecipe]
      }
    }));
  };

  const deleteRecipe = (day, recipeId) => {
    setDays(prev => ({
      ...prev,
      [day]: {
        ...ensureRecipesArray(prev[day]),
        recipes: (prev[day].recipes || []).filter(recipe => recipe.id !== recipeId)
      }
    }));
  };

  const updateRecipeServings = (day, recipeId, servings) => {
    setDays(prev => ({
      ...prev,
      [day]: {
        ...ensureRecipesArray(prev[day]),
        recipes: (prev[day].recipes || []).map(recipe => 
          recipe.id === recipeId 
            ? { ...recipe, servings: parseInt(servings) || 0 }
            : recipe
        )
      }
    }));
  };

  const updateRecipeName = (day, recipeId, name) => {
    setDays(prev => ({
      ...prev,
      [day]: {
        ...ensureRecipesArray(prev[day]),
        recipes: (prev[day].recipes || []).map(recipe => 
          recipe.id === recipeId 
            ? { ...recipe, name: name }
            : recipe
        )
      }
    }));
  };

  // Enhanced scaling function that handles unknown amounts properly
  const scaleIngredient = (ingredient, totalPeople, originalServings) => {
    // Handle unknown amounts transparently
    if (ingredient.amount === '?' || ingredient.amount === '') {
      return {
        ...ingredient,
        originalAmount: `?${ingredient.unit}`,
        scaledAmount: `?${ingredient.unit}`,
        scalingNote: 'Mængde ikke angivet - tjek opskrift'
      };
    }
    
    // Avoid division by zero
    if (originalServings === 0) {
      return {
        ...ingredient,
        originalAmount: `${ingredient.amount}${ingredient.unit}`,
        scaledAmount: `${ingredient.amount}${ingredient.unit}`,
        scalingNote: 'Original servings was 0 - no scaling applied'
      };
    }
    
    const scalingFactor = totalPeople / originalServings;
    
    // Parse the original amount using enhanced parsing
    const originalAmount = parseDanishNumber(ingredient.amount);
    
    // Handle case where parsing returns '?' (unknown amount)
    if (originalAmount === '?') {
      return {
        ...ingredient,
        originalAmount: `?${ingredient.unit}`,
        scaledAmount: `?${ingredient.unit}`,
        scalingNote: 'Kunne ikke bestemme mængde - tjek opskrift'
      };
    }
    
    // Calculate the scaled amount
    const scaledAmount = originalAmount * scalingFactor;
    
    // Special handling for certain units that shouldn't be scaled below practical minimums
    let finalScaledAmount = scaledAmount;
    const unit = ingredient.unit.toLowerCase();
    
    // For spices and small quantities, apply minimum thresholds
    if (DANISH_UNIT_CATEGORIES.spoons.includes(unit)) {
      // Don't scale spoon measurements below 0.25 (1/4 teaspoon)
      if (finalScaledAmount < 0.25 && originalAmount >= 0.25) {
        finalScaledAmount = 0.25;
      }
    }
    
    // For pieces, round to reasonable numbers
    if (DANISH_UNIT_CATEGORIES.pieces.includes(unit) || DANISH_UNIT_CATEGORIES.special_danish.includes(unit)) {
      // Round pieces to nearest 0.5 for practical shopping
      finalScaledAmount = Math.round(finalScaledAmount * 2) / 2;
    }
    
    // Format the result with appropriate precision
    const formattedAmount = formatDanishNumber(finalScaledAmount);
    
    return {
      ...ingredient,
      originalAmount: `${ingredient.amount}${ingredient.unit}`,
      scaledAmount: `${formattedAmount}${ingredient.unit}`,
      scalingFactor: scalingFactor
    };
  };

  // Enhanced ingredient categorization that considers units
  const categorizeIngredient = (ingredient) => {
    const normalizedName = normalizeIngredient(ingredient.name);
    
    // Handle case where normalizeIngredient returns null
    if (!normalizedName) {
      return 'Ukategoriseret';
    }
    
    const unit = ingredient.unit ? ingredient.unit.toLowerCase() : '';
    
    // Use unit information to help with categorization
    if (DANISH_UNIT_CATEGORIES.weight.includes(unit) || DANISH_UNIT_CATEGORIES.pieces.includes(unit)) {
      // Check if it's likely meat/fish based on weight units
      if (Object.entries(FOOD_CATEGORIES).find(([category, keywords]) => 
        category === '🥩 Kød/Fisk' && keywords.some(word => normalizedName.includes(word))
      )) {
        return '🥩 Kød/Fisk';
      }
    }
    
    // Default categorization
    return Object.entries(FOOD_CATEGORIES).find(([_, keywords]) =>
      keywords.some(word => normalizedName.includes(word))
    )?.[0] || 'Ukategoriseret';
  };

  // Get all ingredients from all recipes across all days
  const getAllIngredients = () => {
    const allIngredients = [];
    
    Object.entries(days).forEach(([dayName, dayData]) => {
      const safeData = ensureRecipesArray(dayData);
      const totalPeople = calculateTotalPeople(safeData.adults, safeData.kids, safeData.teens);
      
      safeData.recipes.forEach(recipe => {
        recipe.ingredients.forEach(ingredient => {
          const scaledIngredient = scaleIngredient(
            ingredient, 
            totalPeople, 
            recipe.servings
          );
          allIngredients.push({
            ...scaledIngredient,
            day: dayName,
            recipeName: recipe.name
          });
        });
      });
    });
    
    return allIngredients;
  };

  // Export all data to single CSV file
  const exportToExcel = () => {
    let csvContent = '';
    
    // Section 1: Oversigt
    csvContent += 'OVERSIGT\n';
    csvContent += 'Dag;V;B;O;Total;Borde;Beløb\n';
    
    Object.entries(days).forEach(([dayName, dayData]) => {
      csvContent += `${dayName};${dayData.adults || 0};${dayData.kids || 0};${dayData.teens || 0};${formatDanishNumber(calculateTotalPeople(dayData.adults, dayData.kids, dayData.teens))};${calculateTables(dayData.adults, dayData.kids, dayData.teens)};${Math.round(calculateCost(dayName, dayData.adults, dayData.kids, dayData.teens))}\n`;
    });
    
    // Add summary rows
    csvContent += '\n';
    csvContent += `I alt;;;;;;${Math.round(calculateTotalCost())}\n`;
    csvContent += `Basisvarer (15%);;;;;;${Math.round(calculateBasisvarer())}\n`;
    csvContent += `Til indkøber;;;;;;${Math.round(calculateTilIndkøber())}\n`;
    
    // Section 2: Opskrifter
    csvContent += '\n\nOPSKRIFTER\n';
    csvContent += 'Dag;Opskrift;Oprindeligt lavet til;Ingrediens;Mængde;Enhed\n';
    
    Object.entries(days).forEach(([dayName, dayData]) => {
      const safeData = ensureRecipesArray(dayData);
      const totalPeople = calculateTotalPeople(safeData.adults, safeData.kids, safeData.teens);
      
      safeData.recipes.forEach(recipe => {
        recipe.ingredients.forEach((ingredient, idx) => {
          const scaledIngredient = scaleIngredient(ingredient, totalPeople, recipe.servings);
          csvContent += `${idx === 0 ? dayName : ''};${idx === 0 ? recipe.name : ''};${idx === 0 ? recipe.servings : ''};${scaledIngredient.name};${scaledIngredient.scaledAmount.replace(scaledIngredient.unit, '').trim()};${scaledIngredient.unit}\n`;
        });
        // Add empty row between recipes for clarity
        if (recipe.ingredients.length > 0) {
          csvContent += '\n';
        }
      });
    });
    
    // Section 3: Indkøbsliste
    csvContent += '\n\nINDKØBSLISTE\n';
    csvContent += 'Kategori;Ingrediens;Enhed;Total Mængde\n';

    const allIngredients = getAllIngredients();
    const ingredientsByCategory = {};
    const categories = ['🥩 Kød/Fisk', '🧀 Mejeri', '🥕 Grønt', '🥫 Kolonial', 'Ukategoriseret'];
    
    categories.forEach(category => {
      ingredientsByCategory[category] = new Map();
    });

    allIngredients.forEach((ingredient) => {
      const normalizedName = normalizeIngredient(ingredient.name);
      if (!normalizedName) return; // Skip invalid ingredients
      
      const category = categorizeIngredient(ingredient);
      const key = `${normalizedName}_${ingredient.unit}`;
      
      if (!ingredientsByCategory[category].has(key)) {
        ingredientsByCategory[category].set(key, {
          name: ingredient.name,
          unit: ingredient.unit,
          totalAmount: 0
        });
      }
      
      const scaledNum = parseDanishNumber(ingredient.scaledAmount.replace(ingredient.unit, ''));
      if (scaledNum !== '?' && typeof scaledNum === 'number') {
        ingredientsByCategory[category].get(key).totalAmount += scaledNum;
      }
    });

    categories.forEach(category => {
      const categoryIngredients = ingredientsByCategory[category];
      if (categoryIngredients.size > 0) {
        categoryIngredients.forEach(ingredient => {
          const totalAmount = ingredient.totalAmount;
          let totalFormatted;
          if (totalAmount === 0 || isNaN(totalAmount)) {
            totalFormatted = '?';
          } else {
            totalFormatted = formatDanishNumber(totalAmount);
          }
          
          csvContent += `${category};${ingredient.name};${ingredient.unit || ''};${totalFormatted}\n`;
        });
      }
    });

    // Create and download the file
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `fælleden_komplet_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Tab content renderers
  const renderOversigt = () => (
    <div className="bg-white rounded-2xl shadow-lg border border-zinc-100 p-8">
      <h2 className="text-2xl font-semibold text-zinc-900 mb-8">Ugentlig oversigt</h2>
      
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-zinc-50">
              <th className="border border-zinc-200 px-4 py-3 text-left font-semibold text-zinc-900">Dag</th>
              <th className="border border-zinc-200 px-4 py-3 text-left font-semibold text-zinc-900">V</th>
              <th className="border border-zinc-200 px-4 py-3 text-left font-semibold text-zinc-900">B</th>
              <th className="border border-zinc-200 px-4 py-3 text-left font-semibold text-zinc-900">O</th>
              <th className="border border-zinc-200 px-4 py-3 text-left font-semibold text-zinc-900">Total</th>
              <th className="border border-zinc-200 px-4 py-3 text-left font-semibold text-zinc-900">Borde</th>
              <th className="border border-zinc-200 px-4 py-3 text-left font-semibold text-zinc-900">Beløb</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(days).map(([dayName, dayData]) => (
              <tr key={dayName} className="hover:bg-zinc-50">
                <td className="border border-zinc-200 px-4 py-3 font-medium text-zinc-900">{dayName}</td>
                <td className="border border-zinc-200 px-4 py-3">
                  <input
                    type="number"
                    min="0"
                    value={dayData.adults || ''}
                    onChange={(e) => updatePeople(dayName, 'adults', e.target.value)}
                    className="w-20 px-2 py-1 border border-zinc-200 rounded focus:outline-none focus:ring-2 focus:ring-zinc-600 text-center"
                  />
                </td>
                <td className="border border-zinc-200 px-4 py-3">
                  <input
                    type="number"
                    min="0"
                    value={dayData.kids || ''}
                    onChange={(e) => updatePeople(dayName, 'kids', e.target.value)}
                    className="w-20 px-2 py-1 border border-zinc-200 rounded focus:outline-none focus:ring-2 focus:ring-zinc-600 text-center"
                  />
                </td>
                <td className="border border-zinc-200 px-4 py-3">
                  <input
                    type="number"
                    min="0"
                    value={dayData.teens || ''}
                    onChange={(e) => updatePeople(dayName, 'teens', e.target.value)}
                    className="w-20 px-2 py-1 border border-zinc-200 rounded focus:outline-none focus:ring-2 focus:ring-zinc-600 text-center"
                  />
                </td>
                <td className="border border-zinc-200 px-4 py-3 font-medium text-zinc-900">
                  {formatDanishNumber(calculateTotalPeople(dayData.adults, dayData.kids, dayData.teens))}
                </td>
                <td className="border border-zinc-200 px-4 py-3 font-medium text-zinc-900">
                  {calculateTables(dayData.adults, dayData.kids, dayData.teens)}
                </td>
                <td className="border border-zinc-200 px-4 py-3 font-medium text-zinc-900">
                  {Math.round(calculateCost(dayName, dayData.adults, dayData.kids, dayData.teens))} kr
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-zinc-100 font-bold">
              <td className="border border-zinc-200 px-4 py-3" colSpan="6">I alt:</td>
              <td className="border border-zinc-200 px-4 py-3 text-zinc-900">
                {Math.round(calculateTotalCost())} kr
              </td>
            </tr>
            <tr className="bg-zinc-100 font-bold">
              <td className="border border-zinc-200 px-4 py-3" colSpan="6">Basisvarer (15%):</td>
              <td className="border border-zinc-200 px-4 py-3 text-zinc-900">
                {Math.round(calculateBasisvarer())} kr
              </td>
            </tr>
            <tr className="bg-zinc-100 font-bold">
              <td className="border border-zinc-200 px-4 py-3" colSpan="6">Til indkøber:</td>
              <td className="border border-zinc-200 px-4 py-3 text-zinc-900">
                {Math.round(calculateTilIndkøber())} kr
              </td>
            </tr>
          </tfoot>
        </table>
        <div className="mt-8 text-center">
        <button
          onClick={() => setActiveTab('Opskrifter')}
          className="px-8 py-3 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-all shadow-sm font-medium"
        >
          Næste: Opskrifter →
        </button>
      </div>
    </div>
      
      <div className="mt-6 text-sm text-zinc-600">
        <p><strong>V:</strong> Voksne | <strong>B:</strong> Børn | <strong>O:</strong> Små børn</p>
        <p><strong>Total:</strong> V + (B÷2) + (O÷2) | <strong>Borde:</strong> (V+B+O)÷6 personer per bord</p>
        <p><strong>Beløb:</strong> Man-Tor: V×44kr + B×22kr | Fre: V×60kr + B×30kr (O er ikke inkluderet)</p>
      </div>
    </div>
  );

  const renderOpskrifter = () => (
    <div className="space-y-8">
      {Object.entries(days).map(([dayName, dayData]) => (
        <div key={dayName} className="bg-white rounded-2xl shadow-lg border border-zinc-100 p-8">
          <h2 className="text-2xl font-semibold text-zinc-900 mb-4">
            {dayName} - {formatDanishNumber(calculateTotalPeople(dayData.adults, dayData.kids, dayData.teens))} personer
          </h2>
          
          {/* Success/Error Message */}
          {dayData.successMessage && (
            <div className={`p-4 rounded-lg mb-6 ${
              dayData.successMessage.includes('❌') 
                ? 'bg-red-100 text-red-800' 
                : 'bg-green-100 text-green-800'
            }`}>
              {dayData.successMessage}
            </div>
          )}

          {/* Add Recipe Form */}
          <form onSubmit={(e) => handleUrlSubmit(dayName, e)} className="mb-6">
            <div className="flex gap-3">
              <input
                type="url"
                value={recipeUrls[dayName] || ''}
                onChange={(e) => setRecipeUrls(prev => ({ ...prev, [dayName]: e.target.value }))}
                placeholder="Indsæt opskrift URL her"
                className="flex-1 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:border-transparent transition-all"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !recipeUrls[dayName]?.trim()}
                className="flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 disabled:bg-zinc-400 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
              >
                <Link className="w-5 h-5" />
                {loading ? 'Behandler...' : 'Tilføj'}
              </button>
            </div>
          </form>

          {/* Recipe List */}
          {(dayData.recipes || []).length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              <p>Ingen opskrifter tilføjet til {dayName} endnu</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(dayData.recipes || []).map((recipe) => (
                <div key={recipe.id} className="bg-zinc-50 rounded-lg p-4 border border-zinc-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1">
                      <input
                        type="text"
                        value={recipe.name}
                        onChange={(e) => updateRecipeName(dayName, recipe.id, e.target.value)}
                        className="flex-1 px-3 py-2 bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-600 text-sm"
                        placeholder="Opskriftnavn"
                      />
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-zinc-600">Oprindeligt lavet til:</label>
                        <input
                          type="number"
                          min="1"
                          value={recipe.servings}
                          onChange={(e) => updateRecipeServings(dayName, recipe.id, e.target.value)}
                          className="w-20 px-3 py-2 bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-600 text-sm"
                        />
                      </div>
                      <button
                        onClick={() => deleteRecipe(dayName, recipe.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Slet opskrift"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Ingredients for this recipe */}
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-zinc-700 mb-2">Ingredienser:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
                      {recipe.ingredients.map((ingredient, idx) => {
                        const totalPeople = calculateTotalPeople(dayData.adults, dayData.kids, dayData.teens);
                        const scaledIngredient = scaleIngredient(ingredient, totalPeople, recipe.servings);
                        return (
                          <div key={idx} className="text-zinc-600">
                            <span className="font-medium">{scaledIngredient.scaledAmount.replace(scaledIngredient.unit, '').trim()}</span>
                            <span className="text-zinc-500 ml-1">{scaledIngredient.unit}</span>
                            <span className="ml-2">{scaledIngredient.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      
      <div className="mt-8 text-center">
        <button
          onClick={() => setActiveTab('Indkøbsliste')}
          className="px-8 py-3 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-all shadow-sm font-medium"
        >
          Næste: Indkøbsliste →
        </button>
      </div>
    </div>
  );

  const renderIndkøbsliste = () => {
    const allIngredients = getAllIngredients();
    
    // Group ingredients by category and consolidate
    const ingredientsByCategory = {};
    const categories = ['🥩 Kød/Fisk', '🧀 Mejeri', '🥕 Grønt', '🥫 Kolonial', 'Ukategoriseret'];
    
    categories.forEach(category => {
      ingredientsByCategory[category] = new Map();
    });

    allIngredients.forEach((ingredient) => {
      const normalizedName = normalizeIngredient(ingredient.name);
      const category = categorizeIngredient(ingredient);
      const key = `${normalizedName}_${ingredient.unit}`;
      
      if (!ingredientsByCategory[category].has(key)) {
        ingredientsByCategory[category].set(key, {
          name: ingredient.name,
          unit: ingredient.unit,
          totalAmount: 0,
          scaledAmounts: []
        });
      }
      
      const item = ingredientsByCategory[category].get(key);
      const scaledNum = parseDanishNumber(ingredient.scaledAmount.replace(ingredient.unit, ''));
      
      if (scaledNum !== '?' && typeof scaledNum === 'number') {
        item.totalAmount += scaledNum;
      }
      item.scaledAmounts.push(ingredient.scaledAmount);
    });

    return (
      <div className="bg-white rounded-2xl shadow-lg border border-zinc-100 p-8">
        <h2 className="text-2xl font-semibold text-zinc-900 mb-8">Samlet Indkøbsliste</h2>

        {categories.map(category => {
          const categoryIngredients = Array.from(ingredientsByCategory[category].values());
          if (categoryIngredients.length === 0) return null;

          return (
            <div key={category} className="mb-10">
              <h3 className={`text-xl font-semibold mb-6 ${category === 'Ukategoriseret' ? 'text-amber-600' : 'text-zinc-900'}`}>
                {category}
              </h3>
              <div className="space-y-3">
                {categoryIngredients.map((ingredient, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-zinc-50 rounded-lg border border-zinc-200">
                    <div className="flex-1">
                      <span className="font-medium text-zinc-900">{ingredient.name}</span>
                      {ingredient.unit && (
                        <span className="text-zinc-500 ml-2">({ingredient.unit})</span>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-zinc-900">
                        {ingredient.totalAmount > 0 
                          ? `${formatDanishNumber(ingredient.totalAmount)} ${ingredient.unit}` 
                          : `? ${ingredient.unit}`
                        }
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-4xl font-bold text-zinc-900 mb-2">🍝 Fælledens opskriftberegner</h1>
            <p className="text-zinc-600">Beregn ingredienser baseret på antal personer</p>
          </div>
          <button
            onClick={exportToExcel}
            className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all shadow-sm font-medium"
          >
            📊 Eksporter Alt
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-3 mb-10 overflow-x-auto pb-2 scrollbar-hide">
          {['Oversigt', 'Opskrifter', 'Indkøbsliste'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 whitespace-nowrap ${
                activeTab === tab 
                  ? 'bg-zinc-900 text-white shadow-md transform scale-105' 
                  : 'bg-white text-zinc-700 hover:bg-zinc-50 border border-zinc-200 hover:border-zinc-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'Oversigt' && renderOversigt()}
        {activeTab === 'Opskrifter' && renderOpskrifter()}
        {activeTab === 'Indkøbsliste' && renderIndkøbsliste()}
      </div>
    </div>
  );
};

export default App;