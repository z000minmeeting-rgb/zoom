import type { LucideIcon } from 'lucide-react';
import { Eye, FileText, Info, Lock, Monitor, Video, Volume2 } from 'lucide-react';

type Meeting = {
  id: string;
  title: string;
  time: string;
  participants: number;
  type: string;
  duration: string;
};

type Chat = {
  id: string;
  name: string;
  message: string;
  time: string;
  unread: number;
};

export const upcomingMeetings: Meeting[] = [];
export const recentChats: Chat[] = [];

export const settingsSections: Array<{ icon: LucideIcon; label: string; description: string }> = [
  { icon: Video, label: 'Meetings', description: 'Configure meeting preferences' },
  { icon: Volume2, label: 'Audio', description: 'Microphone and speaker settings' },
  { icon: Monitor, label: 'Video', description: 'Camera and video quality' },
  { icon: Eye, label: 'Accessibility', description: 'Screen reader and display options' },
  { icon: Lock, label: 'Privacy', description: 'Data and privacy controls' },
  { icon: FileText, label: 'Terms', description: 'Terms of service' },
  { icon: Info, label: 'About', description: 'Version and support information' },
];
