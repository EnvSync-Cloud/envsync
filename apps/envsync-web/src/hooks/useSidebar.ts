import { useState, useEffect } from 'react';

const SIDEBAR_STORAGE_KEY = 'envsync-sidebar-expanded';

export const useSidebar = () => {
  // Initialize sidebar state from localStorage or default to true
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      return saved !== null ? JSON.parse(saved) : true;
    } catch (error) {
      console.warn('Failed to parse sidebar state from localStorage:', error);
      return true;
    }
  });

  // Save sidebar state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(sidebarExpanded));
    } catch (error) {
      console.warn('Failed to save sidebar state to localStorage:', error);
    }
  }, [sidebarExpanded]);

  // Toggle sidebar state
  const toggleSidebar = () => {
    setSidebarExpanded(prev => !prev);
  };

  // Set sidebar state explicitly
  const setSidebar = (expanded: boolean) => {
    setSidebarExpanded(expanded);
  };

  return {
    sidebarExpanded,
    toggleSidebar,
    setSidebar,
  };
};
