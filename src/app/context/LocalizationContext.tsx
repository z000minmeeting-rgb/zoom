import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';

export type AppLanguage = 'en' | 'it';

type LocalizationContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (value: string) => string;
  formatDate: (value: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  formatCurrency: (value: number, currency?: string) => string;
};

const LANGUAGE_KEY = 'zoo-app-language';
const LocaleContext = createContext<LocalizationContextValue | undefined>(undefined);
const originalText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<HTMLElement, Map<string, string>>();

// This catalogue is deliberately keyed by the English source copy.  It lets legacy
// screens remain localized while new screens can use `t()` from this context.
const italian: Record<string, string> = {
  'Home': 'Home', 'Meetings': 'Riunioni', 'Team Chat': 'Chat del team', 'Mail': 'Posta',
  'Calendar': 'Calendario', 'Whiteboards': 'Lavagne', 'Contacts': 'Contatti', 'Admin': 'Amministrazione',
  'Settings': 'Impostazioni', 'Search meetings, contacts, messages...': 'Cerca riunioni, contatti, messaggi...',
  'Messages': 'Messaggi', 'Mark all read': 'Segna tutti come letti', 'No message notifications.': 'Nessuna notifica di messaggi.',
  'unread': 'non letti', 'Recent Chats': 'Chat recenti', 'View all': 'Vedi tutti', 'No recent chats': 'Nessuna chat recente',
  'Your conversations will appear here after you start chatting.': 'Le tue conversazioni appariranno qui dopo aver iniziato a chattare.',
  'Marketing Team': 'Team marketing', '8 online': '8 online', 'Message Marketing Team...': 'Scrivi al team marketing...',
  'Manage your workspace preferences': 'Gestisci le preferenze del tuo spazio di lavoro', 'Account Information': 'Informazioni account',
  'Email': 'E-mail', 'No email added': 'Nessuna e-mail aggiunta', 'Version': 'Versione', 'Plan': 'Piano', 'Sign Out': 'Esci',
  'Meetings': 'Riunioni', 'Configure meeting preferences': 'Configura le preferenze delle riunioni',
  'Audio': 'Audio', 'Microphone and speaker settings': 'Impostazioni di microfono e altoparlante',
  'Video': 'Video', 'Camera and video quality': 'Fotocamera e qualità video', 'Accessibility': 'Accessibilità',
  'Screen reader and display options': 'Opzioni di lettore schermo e visualizzazione', 'Privacy': 'Privacy',
  'Data and privacy controls': 'Controlli dei dati e della privacy', 'Terms': 'Termini', 'Terms of service': 'Termini di servizio',
  'About': 'Informazioni', 'Version and support information': 'Informazioni su versione e supporto',
  'Loading...': 'Caricamento...', 'Loading workspace...': 'Caricamento dello spazio di lavoro...',
  'Welcome': 'Benvenuto', 'Get started': 'Inizia', 'Back': 'Indietro', 'Continue': 'Continua', 'Cancel': 'Annulla',
  'Save': 'Salva', 'Close': 'Chiudi', 'Delete': 'Elimina', 'Edit': 'Modifica', 'Send': 'Invia', 'Upload': 'Carica',
  'Download': 'Scarica', 'Confirm': 'Conferma', 'Retry': 'Riprova', 'Required': 'Obbligatorio',
  'Today': 'Oggi', 'Yesterday': 'Ieri', 'Attachment': 'Allegato', 'Read': 'Letto', 'Unread': 'Non letto',
  'Pending verification': 'Verifica in attesa', 'Management is reviewing this payment proof.': 'L’amministrazione sta esaminando questa prova di pagamento.',
  'Payment approved': 'Pagamento approvato', 'Management has approved this payment proof.': 'L’amministrazione ha approvato questa prova di pagamento.',
  'Payment declined': 'Pagamento rifiutato', 'Management declined this payment proof.': 'L’amministrazione ha rifiutato questa prova di pagamento.',
  'Awaiting your approval': 'In attesa della tua approvazione', 'Approve': 'Approva', 'Decline': 'Rifiuta',
  'Exclusive host': 'Host esclusivo', 'Select access': 'Scegli l’accesso', 'Register and pay': 'Registrati e paga',
  'Upload proof': 'Carica la prova', 'Call scheduling': 'Programmazione chiamata', 'Choose a package': 'Scegli un pacchetto',
  'Choose your subscription package': 'Scegli il tuo pacchetto di abbonamento', 'Subscribe': 'Abbonati',
  'Continue to registration': 'Continua alla registrazione', 'Payment verification': 'Verifica del pagamento',
  'Secure booking': 'Prenotazione sicura', 'Private video call': 'Videochiamata privata',
  'Sign in': 'Accedi', 'Sign up': 'Registrati', 'Create account': 'Crea account', 'Forgot password?': 'Password dimenticata?',
  'Email address': 'Indirizzo e-mail', 'Password': 'Password', 'Full name': 'Nome completo',
  'Already have an account?': 'Hai già un account?', 'Don’t have an account?': 'Non hai un account?',
  'Email or password is incorrect.': 'L’e-mail o la password non sono corrette.',
  'An account with this email already exists.': 'Esiste già un account con questa e-mail.',
  'Join meeting': 'Partecipa alla riunione', 'Meeting details': 'Dettagli riunione', 'Meeting history': 'Cronologia riunioni',
  'No upcoming meetings': 'Nessuna riunione in programma', 'No meeting history': 'Nessuna cronologia riunioni',
  'Language': 'Lingua', 'English': 'Inglese', 'Italian': 'Italiano', 'Italiano': 'Italiano',
  'Choose the language used across the application': 'Scegli la lingua utilizzata in tutta l’applicazione',
  'Dashboard': 'Bacheca', 'Overview': 'Panoramica', 'Upcoming meetings': 'Riunioni in programma',
  'Start a meeting': 'Avvia una riunione', 'Schedule a meeting': 'Programma una riunione',
  'Join': 'Partecipa', 'Join now': 'Partecipa ora', 'Leave': 'Esci', 'Copy link': 'Copia link',
  'Meeting link': 'Link della riunione', 'Meeting ID': 'ID riunione', 'Passcode': 'Codice di accesso',
  'Participants': 'Partecipanti', 'Host': 'Host', 'Date': 'Data', 'Time': 'Ora', 'Duration': 'Durata',
  'Profile': 'Profilo', 'Account': 'Account', 'Notifications': 'Notifiche', 'Help': 'Aiuto',
  'Success': 'Operazione completata', 'Error': 'Errore', 'Something went wrong.': 'Qualcosa è andato storto.',
  'No results found.': 'Nessun risultato trovato.', 'No data available.': 'Nessun dato disponibile.',
  'Media file uploaded': 'File multimediale caricato', 'Type a message...': 'Scrivi un messaggio...',
  'Choose file': 'Scegli file', 'Remove': 'Rimuovi', 'Reply': 'Rispondi', 'Payment proof': 'Prova di pagamento',
  'Subscription': 'Abbonamento', 'Subscription packages': 'Pacchetti di abbonamento',
  'Registration': 'Registrazione', 'Payment': 'Pagamento', 'Booking confirmation': 'Conferma della prenotazione',
  'Manage workspace messages': 'Gestisci i messaggi dello spazio di lavoro', 'Review upcoming workspace events': 'Consulta i prossimi eventi dello spazio di lavoro',
  'Create and review shared boards': 'Crea e consulta lavagne condivise', 'Browse people in your workspace': 'Sfoglia le persone nel tuo spazio di lavoro',
};

function translate(value: string, language: AppLanguage) {
  if (language === 'en') return value;
  return italian[value] ?? value;
}

function localizeDocument(language: AppLanguage) {
  document.documentElement.lang = language === 'it' ? 'it' : 'en';
  document.documentElement.dir = 'ltr';
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
  textNodes.forEach((node) => {
    const parent = node.parentElement;
    if (!parent || parent.closest('[data-no-translate], script, style')) return;
    const source = originalText.get(node) ?? node.data.trim();
    if (!source) return;
    originalText.set(node, source);
    const translated = translate(source, language);
    const nextValue = node.data.replace(node.data.trim(), translated);
    if (node.data !== nextValue) node.data = nextValue;
  });
  document.querySelectorAll<HTMLElement>('[placeholder], [title], [aria-label]').forEach((element) => {
    if (element.closest('[data-no-translate]')) return;
    (['placeholder', 'title', 'aria-label'] as const).forEach((attribute) => {
      const attributes = originalAttributes.get(element) ?? new Map<string, string>();
      const source = attributes.get(attribute) ?? element.getAttribute(attribute);
      if (source) {
        attributes.set(attribute, source);
        originalAttributes.set(element, attributes);
        const translated = translate(source, language);
        if (element.getAttribute(attribute) !== translated) element.setAttribute(attribute, translated);
      }
    });
  });
}

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() =>
    window.localStorage.getItem(LANGUAGE_KEY) === 'it' ? 'it' : 'en'
  );
  const setLanguage = (nextLanguage: AppLanguage) => {
    window.localStorage.setItem(LANGUAGE_KEY, nextLanguage);
    setLanguageState(nextLanguage);
  };

  useLayoutEffect(() => {
    localizeDocument(language);
    const observer = new MutationObserver(() => localizeDocument(language));
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [language]);

  const value = useMemo(() => ({
    language, setLanguage, t: (copy: string) => translate(copy, language),
    formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(language === 'it' ? 'it-IT' : 'en-US', options).format(new Date(date)),
    formatCurrency: (amount: number, currency = 'USD') => new Intl.NumberFormat(language === 'it' ? 'it-IT' : 'en-US', { style: 'currency', currency }).format(amount),
  }), [language]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocalization() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useLocalization must be used within LocalizationProvider');
  return context;
}
