import { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../i18n/translations';
import { useAuth } from './AuthContext';

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
      const { user } = useAuth();
      const [language, setLanguage] = useState(localStorage.getItem('language') || 'en');

      // Sync with user preference if logged in
      useEffect(() => {
            if (user?.language && user.language !== language) {
                  setLanguage(user.language);
                  localStorage.setItem('language', user.language);
            }
      }, [user]);

      const t = (key) => {
            return translations[language]?.[key] || translations['en'][key] || key;
      };

      const changeLanguage = (lang) => {
            setLanguage(lang);
            localStorage.setItem('language', lang);
      };

      return (
            <LanguageContext.Provider value={{ language, changeLanguage, t }}>
                  {children}
            </LanguageContext.Provider>
      );
};

export const useLanguage = () => {
      const context = useContext(LanguageContext);
      if (!context) {
            throw new Error('useLanguage must be used within a LanguageProvider');
      }
      return context;
};
