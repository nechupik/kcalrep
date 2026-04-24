// Open Food Facts API integration
import { type Product } from "./products";

// Base URLs for different regions
const API_BASE_URL = 'https://world.openfoodfacts.org/api/v2';
const API_BASE_URL_DE = 'https://world.openfoodfacts.org/cgi/search.pl';

// Search by barcode
export async function searchByBarcode(barcode: string) {
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    if (data.status === 0) {
      return null;
    }
    
    // Map Open Food Facts API fields to our Product interface
    const calories = Math.round(
      data.nutriments?.['energy-kcal_100g'] ||
      data.nutriments?.['energy-kcal'] ||
      Math.round((data.nutriments?.['energy_100g'] || 0) / 4.184) ||
      0
    );

    const product = {
      name: data.product_name || '',
      barcode: data.code || barcode,
      brand: data.brands || data.brand_owner || '',
      calories: calories,
      protein: data.nutriments?.proteins_100g || 0,
      fat: data.nutriments?.fat_100g || 0,
      carbs: data.nutriments?.carbohydrates_100g || 0,
    };
    
    return product;
  } catch (error) {
    console.error('Error searching by barcode:', error);
    return null;
  }
}

// Search by name
export async function searchByName(query: string): Promise<Partial<Product>[]> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10&lc=de&cc=de`;
  
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        if (attempt === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        return [];
      }
      const data = await response.json();
      if (!data.products) return [];
      
      return data.products.map((product: any) => ({
        name: product.product_name || product.product_name_de || 'Unknown',
        brand: product.brands || '',
        barcode: product.code || '',
        calories: Math.round(
          product.nutriments?.['energy-kcal_100g'] ||
          product.nutriments?.['energy-kcal'] ||
          (product.nutriments?.['energy_100g'] || 0) / 4.184 ||
          0
        ),
        protein: Math.round((product.nutriments?.proteins_100g || 0) * 10) / 10,
        fat: Math.round((product.nutriments?.fat_100g || 0) * 10) / 10,
        carbs: Math.round((product.nutriments?.carbohydrates_100g || 0) * 10) / 10,
        source: 'open_food_facts' as const,
        verified: false,
      })).filter((p: any) => p.name && p.name !== 'Unknown');
      
    } catch (error) {
      if (attempt === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      console.error('Error searching by name:', error);
      return [];
    }
  }
  return [];
}
