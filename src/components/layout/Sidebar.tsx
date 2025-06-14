import React, { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Users, 
  BookOpen, 
  Bot, 
  Target,
  Sparkles,
  FileText,
  Map,
  Link
} from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: 'overview', name: 'Overview', icon: FileText },
  { id: 'characters', name: 'Characters', icon: Users },
  { id: 'story', name: 'Story Arcs', icon: BookOpen },
  { id: 'worldbuilding', name: 'World', icon: Map },
  { id: 'crossrefs', name: 'Cross Refs', icon: Link },
  { id: 'ai', name: 'AI Assistant', icon: Bot },
  { id: 'prompts', name: 'Prompts', icon: Sparkles },
];

export function Sidebar({ isCollapsed, onToggle, activeTab, onTabChange }: SidebarProps) {
  return (
    <div className={`bg-gray-50 border-r border-gray-200 transition-all duration-300 ${
      isCollapsed ? 'w-16' : 'w-80'
    }`}>
      <div className="p-4 border-b border-gray-200">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          {!isCollapsed && <span className="font-medium">Writing Tools</span>}
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronLeft className="w-5 h-5" />
          )}
        </button>
      </div>
      
      <nav className="p-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors mb-1 ${
                activeTab === tab.id
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span className="font-medium">{tab.name}</span>}
            </button>
          );
        })}
      </nav>
    </div>
  );
}