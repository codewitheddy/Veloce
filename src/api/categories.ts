import api from './client';
import { Category } from '../types';

export const categoriesApi = {
  /**
   * Retrieves all product categories
   */
  getCategories: async (): Promise<Category[]> => {
    const response = await api.get('/categories/');
    const data = response.data;
    return Array.isArray(data) ? data : (data?.results || []);
  },

  /**
   * Retrieves category detail by ID
   */
  getCategory: async (id: string): Promise<Category> => {
    const response = await api.get(`/categories/${id}/`);
    return response.data;
  },

  /**
   * Creates a new category
   */
  createCategory: async (category: Partial<Category>): Promise<Category> => {
    const response = await api.post('/categories/', category);
    return response.data;
  },

  /**
   * Updates an existing category
   */
  updateCategory: async (id: string, category: Partial<Category>): Promise<Category> => {
    const response = await api.put(`/categories/${id}/`, category);
    return response.data;
  },
};
