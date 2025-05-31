import React, { useState } from 'react';
import { Upload, Link, Users } from 'lucide-react';

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

// Words that should never be considered ingredients
const NON_INGREDIENT_WORDS = new Set([
  'styrke', 'mere', 'mindre', 'efter', 'smag', 'behov', 'ønske', 'cirka', 'ca',
  'evt', 'eventuelt', 'til', 'som', 'eller', 'og', 'af', 'med', 'uden', 'for',
  'servering', 'pynt', 'garnering', 'side', 'ekstra'
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

// Function to initialize the days state
const createInitialDays = () => {
  const weekdays = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag'];
  return weekdays.reduce((acc, day) => ({
    ...acc,
    [day]: { adults: 0, kids: 0, ingredients: [], servings: 4, successMessage: '' }
  }), {});
};

const App = () => {
  const [currentDay, setCurrentDay] = useState('Mandag');
  const [loading, setLoading] = useState(false);
  const [recipeUrl, setRecipeUrl] = useState('');
  const [days, setDays] = useState(createInitialDays());

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith('image/')) {
      alert('Venligst vælg en billedfil (PNG, JPG)');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`${API_URL}/parse-image`, { 
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (data.success) {
        updateIngredients(data.ingredients);
        setSuccessMessage('✅ Ingredienser tilføjet til listen forneden 👇', currentDay);
      } else {
        // Show user-friendly error message for image processing failures
        setSuccessMessage('❌ Kunne ikke læse billedet. Prøv at tage et billede af opskriften i bedre lys eller tættere på.', currentDay);
      }
    } catch (error) {
      setSuccessMessage('❌ Der opstod en fejl under behandling af filen', currentDay);
    } finally {
      setLoading(false);
    }
  };

  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    if (!recipeUrl.trim()) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/parse-url?url=${encodeURIComponent(recipeUrl)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (data.success) {
        updateIngredients(data.ingredients);
        setRecipeUrl('');
        setSuccessMessage('✅ Ingredienser tilføjet til listen forneden 👇', currentDay);
      } else {
        setSuccessMessage('❌ Kunne ikke finde ingredienser på siden. Prøv en anden opskrift URL.', currentDay);
      }
    } catch (error) {
      setSuccessMessage('❌ Der opstod en fejl under behandling af URLen', currentDay);
    } finally {
      setLoading(false);
    }
  };

  const setSuccessMessage = (message, day) => {
    setDays(prev => ({
      ...prev,
      [day]: { ...prev[day], successMessage: message }
    }));
  };

  const updateIngredients = (ingredients) => {
    // Filter and normalize ingredients - remove invalid ones
    const normalizedIngredients = ingredients
      .map(ingredient => {
        const cleanedName = normalizeIngredient(ingredient.name);
        if (!cleanedName) return null; // Filter out invalid ingredients
        
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

    setDays(prev => ({
      ...prev,
      [currentDay]: { ...prev[currentDay], ingredients: uniqueIngredients }
    }));
  };

  const updatePeople = (day, type, value) => {
    setDays(prev => ({
      ...prev,
      [day]: { ...prev[day], [type]: parseInt(value) || 0 }
    }));
  };

  const updateServings = (day, value) => {
    setDays(prev => ({
      ...prev,
      [day]: { ...prev[day], servings: parseInt(value) || 0 }
    }));
  };

  // Enhanced scaling function that handles unknown amounts properly
  const scaleIngredient = (ingredient, adults, kids, originalServings) => {
    const targetServings = adults + (kids / 2);
    
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
    
    const scalingFactor = targetServings / originalServings;
    
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
      scalingFactor: scalingFactor,
      // Add debug info for troubleshooting
      debugInfo: {
        originalParsed: originalAmount,
        scaled: scaledAmount,
        final: finalScaledAmount,
        factor: scalingFactor
      }
    };
  };

  const calculateTotalPeople = (adults, kids) => adults + (kids / 2);

  const isCurrentDayValid = () => {
    const { servings, adults, kids } = days[currentDay];
    return servings > 0 && (adults > 0 || kids > 0);
  };

  // Enhanced ingredient categorization that considers units
  const categorizeIngredient = (ingredient) => {
    const normalizedName = normalizeIngredient(ingredient.name);
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

  // IngredientTable component
  const IngredientTable = ({ category }) => {
    const groupedIngredients = Object.values(days)
      .flatMap(day => day.ingredients)
      .reduce((acc, ingredient) => {
        const normName = normalizeIngredient(ingredient.name);
        const key = `${normName}_${ingredient.unit}`;
        if (!acc[key]) {
          acc[key] = { ...ingredient, occurrences: 1 };
        } else {
          acc[key].occurrences += 1;
        }
        return acc;
      }, {});

    const categoryIngredients = Object.values(groupedIngredients)
      .filter((ingredient) => categorizeIngredient(ingredient) === category);

    if (categoryIngredients.length === 0) return null;

    return (
      <div key={category} className="mb-10">
        <h3 className={`text-xl font-semibold mb-6 ${category === 'Ukategoriseret' ? 'text-amber-600' : 'text-zinc-900'}`}>
          {category}
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed border-separate border-spacing-0">
            <thead>
              <tr className="bg-zinc-50 rounded-lg">
                <th className="w-64 px-6 py-4 text-left text-sm font-semibold text-zinc-900 first:rounded-l-lg">
                  Ingrediens
                </th>
                <th className="w-24 px-6 py-4 text-left text-sm font-semibold text-zinc-900">
                  Enhed
                </th>
                {Object.keys(days).map(day => (
                  <th key={day} className="w-36 px-6 py-4 text-left text-sm font-semibold text-zinc-900 last:rounded-r-lg">
                    <div className="font-semibold">{day}</div>
                    <div className="text-xs font-normal text-zinc-500 mt-1">
                      {calculateTotalPeople(days[day].adults, days[day].kids)} personer
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {categoryIngredients.map(ingredient => (
                <tr key={`${ingredient.name}_${ingredient.unit}`} className="hover:bg-zinc-50 transition-colors">
                  <td className="w-64 px-6 py-4 text-sm text-zinc-900">
                    <div className="font-medium whitespace-pre-wrap break-words">
                      {ingredient.name}
                    </div>
                    <div className="text-zinc-500 font-normal mt-1">
                      ({ingredient.occurrences} gange)
                    </div>
                  </td>
                  <td className="w-24 px-6 py-4 text-sm text-zinc-600">
                    {ingredient.unit || '-'}
                  </td>
                  {Object.entries(days).map(([dayName, dayData]) => {
                    const dayIngredient = dayData.ingredients.find(i => 
                      normalizeIngredient(i.name) === normalizeIngredient(ingredient.name) && 
                      i.unit === ingredient.unit
                    );
                    if (!dayIngredient) return (
                      <td key={dayName} className="w-36 px-6 py-4 text-sm text-zinc-400">-</td>
                    );
                    const scaled = scaleIngredient(dayIngredient, dayData.adults, dayData.kids, dayData.servings);
                    // Extract just the amount (remove unit from scaledAmount)
                    const amountOnly = scaled.scaledAmount.replace(dayIngredient.unit, '').trim();
                    const originalAmountOnly = scaled.originalAmount.replace(dayIngredient.unit, '').trim();
                    return (
                      <td key={dayName} className="w-36 px-6 py-4">
                        <div className={`text-sm font-medium ${amountOnly === '?' ? 'text-amber-600' : 'text-zinc-900'}`}>
                          {amountOnly}
                        </div>
                        <div className="text-xs text-zinc-500 mt-1">
                          {amountOnly === '?' ? 
                            'Tjek opskrift for mængde' : 
                            `(original: ${originalAmountOnly} til ${dayData.servings} personer)`
                          }
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Enhanced CSV export that preserves measurement accuracy
  const exportToCSV = () => {
    const categories = ['🥩 Kød/Fisk', '🧀 Mejeri', '🥕 Grønt', '🥫 Kolonial', 'Ukategoriseret'];
    const weekdays = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag'];

    // Use semicolon as delimiter for better Excel compatibility in Denmark
    const headers = ['Kategori', 'Ingrediens', 'Enhed', ...weekdays, 'Total Mængde'];
    let csvContent = headers.join(';') + '\n';

    const ingredientsByCategory = {};
    
    categories.forEach(category => {
      ingredientsByCategory[category] = new Map();
    });

    // Collect all ingredients with their units
    Object.entries(days).forEach(([dayName, dayData]) => {
      dayData.ingredients.forEach((ingredient) => {
        const normalizedName = normalizeIngredient(ingredient.name);
        const category = categorizeIngredient(ingredient);
        
        const key = `${normalizedName}_${ingredient.unit}`;
        
        if (!ingredientsByCategory[category].has(key)) {
          ingredientsByCategory[category].set(key, {
            name: ingredient.name,
            unit: ingredient.unit,
            amounts: {},
            totalAmount: 0
          });
        }
        
        const scaled = scaleIngredient(ingredient, dayData.adults, dayData.kids, dayData.servings);
        const scaledNum = parseDanishNumber(scaled.scaledAmount.replace(ingredient.unit, ''));
        
        ingredientsByCategory[category].get(key).amounts[dayName] = scaled.scaledAmount;
        // Only add to total if we have a valid number (not '?')
        if (scaledNum !== '?' && typeof scaledNum === 'number') {
          ingredientsByCategory[category].get(key).totalAmount += scaledNum;
        }
      });
    });

    // Generate CSV content
    categories.forEach(category => {
      const categoryIngredients = ingredientsByCategory[category];
      
      if (categoryIngredients.size > 0) {
        categoryIngredients.forEach(ingredient => {
          const row = [
            category, 
            ingredient.name,
            ingredient.unit || ''
          ];
          
          weekdays.forEach(day => {
            row.push(ingredient.amounts[day] || '-');
          });
          
          // Add total amount - handle unknown amounts properly
          const totalAmount = ingredient.totalAmount;
          let totalFormatted;
          if (totalAmount === 0 || isNaN(totalAmount)) {
            totalFormatted = '?';
          } else {
            totalFormatted = formatDanishNumber(totalAmount);
          }
          row.push(`${totalFormatted}${ingredient.unit}`);
          
          csvContent += row.join(';') + '\n';
        });
      }
    });

    // Create and download the file
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `indkøbsliste_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-zinc-900 mb-2">🍝 Opskriftberegner</h1>
        <p className="text-zinc-600 mb-8">Beregn ingredienser baseret på antal personer</p>

        <div className="bg-white rounded-2xl shadow-lg border border-zinc-100 p-8 mb-10">
          <h2 className="text-2xl font-semibold text-zinc-900 mb-8">Daglige opskrifter</h2>

          <div className="flex space-x-3 mb-8 overflow-x-auto pb-2 scrollbar-hide">
            {Object.keys(days).map(day => (
              <button
                key={day}
                onClick={() => setCurrentDay(day)}
                className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                  currentDay === day 
                    ? 'bg-zinc-900 text-white shadow-md transform scale-105' 
                    : 'bg-white text-zinc-700 hover:bg-zinc-50 border border-zinc-200 hover:border-zinc-300'
                }`}
              >
                {day}
              </button>
            ))}
          </div>

          <div className="mb-8 bg-zinc-50 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <Users className="text-zinc-700 w-5 h-5" />
              </div>
              <span className="text-base font-medium text-zinc-800">Antal personer for {currentDay}</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {['servings', 'adults', 'kids'].map(type => (
                <div key={type} className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-zinc-700">
                    {type === 'servings' ? 'Hvor mange personer er opskriften lavet til?' : type === 'adults' ? 'Voksne:' : 'Børn & Unge:'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={days[currentDay][type] || ''}
                    onChange={(e) => type === 'servings' ? updateServings(currentDay, e.target.value) : updatePeople(currentDay, type, e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:border-transparent transition-shadow"
                    placeholder={type === 'servings' ? "4" : ""}
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 px-4 py-3 rounded-lg border border-zinc-200">
              <span className="text-sm font-medium text-zinc-700">
                Samlet antal: {calculateTotalPeople(days[currentDay].adults, days[currentDay].kids)} personer
              </span>
            </div>
          </div>

          {/* Success/Error Message: Only show for the current day */}
          {days[currentDay].successMessage && (
            <div className={`p-4 rounded-lg mb-6 ${
              days[currentDay].successMessage.includes('❌') 
                ? 'bg-red-100 text-red-800' 
                : 'bg-green-100 text-green-800'
            }`}>
              {days[currentDay].successMessage}
            </div>
          )}

          <div className="grid md:grid-cols-1 gap-8">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-zinc-900">Tilføj Opskrift URL</h3>
              <form onSubmit={handleUrlSubmit} className="flex gap-3">
                <div className="relative flex-grow group">
                  <input
                    type="url"
                    value={recipeUrl}
                    onChange={(e) => setRecipeUrl(e.target.value)}
                    placeholder="Indsæt opskrift URL her"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:border-transparent transition-all"
                    disabled={loading || !isCurrentDayValid()}
                  />
                  {!isCurrentDayValid() && (
                    <div className="absolute left-1/2 -translate-x-1/2 -top-10 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-zinc-800 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap">
                        Indtast først antal voksne og børn
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-800 rotate-45"></div>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={loading || !isCurrentDayValid()}
                  className="flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 disabled:bg-zinc-400 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
                >
                  <Link className="w-5 h-5" />
                  {loading ? 'Behandler...' : 'Beregn'}
                </button>
              </form>
            </div>


          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-zinc-100 p-8">
          <h2 className="text-2xl font-semibold text-zinc-900 mb-8">Samlet Indkøbsliste</h2>

          {/* Export Button */}
          <button
            onClick={exportToCSV}
            className="mb-6 px-6 py-3 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-all shadow-sm"
          >
            Eksporter
          </button>

          {['🥩 Kød/Fisk', '🧀 Mejeri', '🥕 Grønt', '🥫 Kolonial', 'Ukategoriseret'].map(category => (
            <IngredientTable 
              key={category} 
              category={category}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;