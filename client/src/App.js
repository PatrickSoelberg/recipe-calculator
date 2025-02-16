import React, { useState } from 'react';
import { Upload, Link, Users } from 'lucide-react';

// Configuration for API
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// List of common preparation terms to remove
const preparationTerms = [
  'finthakkede', 'fintrevet', 'pressede', 'hakket', 'finsnittet', 'smuldret', 'kogte',
  'delte', 'opskåret', 'røget', 'skårne', 'kompakte', 'håndfulde', 'skrællede', 'ristede', 'sautéede',
  'opvarmede', 'grillede', 'indbagt', 'stegte', 'blancherede', 'skært', 'skåret i strimler', 'dl', 'fint', 
  'groftrevet', 'skåret i kvarte', 'skåret i halve', 'roftrevet', 'fintsnittet',
];

// Regular expression pattern to match and remove preparation terms
const prepRegex = new RegExp(`(${preparationTerms.join('|')})`, 'gi');

// Normalize ingredient name by removing preparation terms
const normalizeIngredient = (ingredientName) => {
  const normalizedName = ingredientName.toLowerCase().trim();
  return normalizedName.replace(prepRegex, '').trim(); // Remove prep terms and trim any extra spaces
};

// Define food categories with keywords for categorization
const FOOD_CATEGORIES = {
  '🥩 Kød/Fisk': ['kød', 'bøf', 'bacon', 'laks', 'kotelet', 'reje', 'hummer', 'okse', 'oksekød', 'kylling', 'filet', 'bisk', 'torsk', 'kyllingebryst', 'kyllingelår'],
  '🧀 Mejeri': ['mælk', 'smør', 'æg', 'cremefraiche', 'fløde', 'yoghurt', 'ost', 'frossen spinat', 'græsk yoghurt', 'gær', ],
  '🥫 Kolonial': ['mel', 'stivelse', 'stødt', 'tørret', 'krydder', 'kerner', 'mandler', 'nødder', 'pure', 'hakkede tomat', 'tahin', 'kikærter', 'cayenne', 'plader', 'bouillon', 'vin', 'olie','laurbærblade', 'sød paprika', 'paprika', 'muskatnød','pasta', 'fennikelfrø', 'sukker', 'mayonnaise', 'sennep', 'ris', 'garam masala', 'chiliflager', 'bulgur', 'butterbeans', 'honning'],
  '🥕 Grønt': ['kartoffel', 'kartofler', 'løg', 'spidskål', 'hvidløg', 'salat', 'tomat', 'selleri', 'peberfrugt', 'champignon', 'squash', 'aubergine', 'gulerod', 'persille', 'basilikum', 'dild', 'æble', 'citron', 'granatæble', 'pinjekerner', 'rucola', 'ingefær', 'koriander', 'blomkål', 'grønkål']
};

// Function to parse Danish number format
const parseDanishNumber = (str) => {
  if (!str) return 0;
  // Convert Danish number format (comma) to JavaScript format (period)
  return parseFloat(str.replace(',', '.'));
};

// Function to format numbers back to Danish format
const formatDanishNumber = (num) => {
  // Convert back to Danish format and ensure 2 decimal places if it's a decimal number
  const str = num.toFixed(2);
  // Only show decimals if it's not a whole number
  const formatted = str.endsWith('.00') ? str.slice(0, -3) : str.replace('.', ',');
  return formatted;
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
        throw new Error(data.error || 'Failed to process image');
      }
    } catch (error) {
      alert('Der opstod en fejl under behandling af filen');
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
        throw new Error(data.error || 'Failed to process URL');
      }
    } catch (error) {
      alert('Der opstod en fejl under behandling af URLen');
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
    // Normalize ingredients by removing preparation terms
    const normalizedIngredients = ingredients.map(ingredient => ({
      ...ingredient,
      name: normalizeIngredient(ingredient.name),
    }));

    setDays(prev => ({
      ...prev,
      [currentDay]: { ...prev[currentDay], ingredients: normalizedIngredients }
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

  const scaleIngredient = (ingredient, adults, kids, originalServings) => {
    const targetServings = adults + (kids / 2);
    const scalingFactor = targetServings / originalServings;
    
    // Parse the original amount using the Danish number format
    const originalAmount = parseDanishNumber(ingredient.amount);
    
    // Calculate the scaled amount
    const scaledAmount = originalAmount * scalingFactor;
    
    // Format the result back to Danish number format
    return {
      ...ingredient,
      originalAmount: `${ingredient.amount}${ingredient.unit}`,
      scaledAmount: `${formatDanishNumber(scaledAmount)}${ingredient.unit}`
    };
  };

  const calculateTotalPeople = (adults, kids) => adults + (kids / 2);

  const isCurrentDayValid = () => {
    const { servings, adults, kids } = days[currentDay];
    return servings > 0 && (adults > 0 || kids > 0);
  };

  // IngredientTable component
const IngredientTable = ({ category }) => {
  const categorizeIngredient = (name) => {
    const normalizedName = normalizeIngredient(name);
    return Object.entries(FOOD_CATEGORIES).find(([_, keywords]) =>
      keywords.some(word => normalizedName.includes(word))
    )?.[0] || 'Ukategoriseret';
  };

  const groupedIngredients = Object.values(days)
    .flatMap(day => day.ingredients)
    .reduce((acc, ingredient) => {
      const normName = normalizeIngredient(ingredient.name);
      if (!acc[normName]) {
        acc[normName] = { ...ingredient, occurrences: 1 };
      } else {
        acc[normName].occurrences += 1;
      }
      return acc;
    }, {});

  const categoryIngredients = Object.values(groupedIngredients)
    .filter((ingredient) => categorizeIngredient(ingredient.name) === category);

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
              <tr key={ingredient.name} className="hover:bg-zinc-50 transition-colors">
                <td className="w-64 px-6 py-4 text-sm text-zinc-900">
                  <div className="font-medium whitespace-pre-wrap break-words">
                    {ingredient.name}
                  </div>
                  <div className="text-zinc-500 font-normal mt-1">
                    ({ingredient.occurrences} times)
                  </div>
                </td>
                {Object.entries(days).map(([dayName, dayData]) => {
                  const dayIngredient = dayData.ingredients.find(i => i.name === ingredient.name);
                  if (!dayIngredient) return (
                    <td key={dayName} className="w-36 px-6 py-4 text-sm text-zinc-400">-</td>
                  );
                  const scaled = scaleIngredient(dayIngredient, dayData.adults, dayData.kids, dayData.servings);
                  return (
                    <td key={dayName} className="w-36 px-6 py-4">
                      <div className="text-sm font-medium text-zinc-900">{scaled.scaledAmount}</div>
                      <div className="text-xs text-zinc-500 mt-1">
                        (original: {scaled.originalAmount} til {dayData.servings} personer)
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

  // Function to export data as CSV
  const exportToCSV = () => {
    const categories = ['🥩 Kød/Fisk', '🧀 Mejeri', '🥕 Grønt', '🥫 Kolonial', 'Ukategoriseret'];
    const weekdays = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag'];
  
    // Prepare headers
    const headers = ['Kategori', 'Ingrediens', ...weekdays];
    let csvContent = headers.join(';') + '\n';
  
    const categorizeIngredient = (name) => {
      const normalizedName = normalizeIngredient(name);
      return Object.entries(FOOD_CATEGORIES).find(([_, keywords]) =>
        keywords.some(word => normalizedName.includes(word))
      )?.[0] || 'Ukategoriseret';
    };
  
    const ingredientsByCategory = {};
    
    categories.forEach(category => {
      ingredientsByCategory[category] = new Map();
    });
  
    Object.entries(days).forEach(([dayName, dayData]) => {
      dayData.ingredients.forEach((ingredient) => {
        const normalizedName = normalizeIngredient(ingredient.name);
        const category = categorizeIngredient(normalizedName);
        
        if (!ingredientsByCategory[category].has(normalizedName)) {
          ingredientsByCategory[category].set(normalizedName, {
            name: ingredient.name,
            amounts: {}
          });
        }
        
        const scaled = scaleIngredient(ingredient, dayData.adults, dayData.kids, dayData.servings);
        ingredientsByCategory[category].get(normalizedName).amounts[dayName] = scaled.scaledAmount;
      });
    });
  
    categories.forEach(category => {
      const categoryIngredients = ingredientsByCategory[category];
      
      if (categoryIngredients.size > 0) {
        categoryIngredients.forEach(ingredient => {
          const row = [category, ingredient.name];
          
          weekdays.forEach(day => {
            row.push(ingredient.amounts[day] || '-');
          });
          
          csvContent += row.join(';') + '\n';
        });
      }
    });
  
    // Create a Blob for the CSV content
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  
    // Create a download link
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'indkøbsliste.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url); // Clean up the URL object
  }; 
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-zinc-900 mb-2">Opskriftberegner</h1>
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
                    {type === 'servings' ? 'Hvor mange personer er opskriften lavet til?' : type === 'adults' ? 'Voksne:' : 'Børn:'}
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

          {/* Success Message: Only show for the current day */}
          {days[currentDay].successMessage && (
            <div className="bg-green-100 text-green-800 p-4 rounded-lg mb-6">
              {days[currentDay].successMessage}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-8">
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

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-zinc-900">Tilføj Opskrift Billede</h3>
              <div className="relative group">
                <div className="border-2 border-dashed border-zinc-200 rounded-xl p-8 bg-zinc-50 hover:bg-zinc-100 transition-colors">
                  <label className={`flex flex-col items-center ${loading || !isCurrentDayValid() ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                    <div className="p-4 bg-white rounded-full shadow-sm mb-4">
                      <Upload className="w-8 h-8 text-zinc-600" />
                    </div>
                    <span className="text-base text-zinc-700 font-medium">{loading ? 'Behandler...' : 'Klik for at uploade'}</span>
                    <span className="text-sm text-zinc-500 mt-2">eller træk filen hertil</span>
                    <span className="text-xs text-zinc-400 mt-1">PNG, JPG op til 10MB</span>
                    <input
                      type="file"
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden"
                      disabled={loading || !isCurrentDayValid()}
                    />
                  </label>
                </div>
                {!isCurrentDayValid() && (
                  <div className="absolute left-1/2 -translate-x-1/2 -top-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-zinc-800 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap">
                      Indtast først antal voksne og børn
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-800 rotate-45"></div>
                    </div>
                  </div>
                )}
              </div>
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
              days={days}
              calculateTotalPeople={calculateTotalPeople}
              scaleIngredient={scaleIngredient}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
