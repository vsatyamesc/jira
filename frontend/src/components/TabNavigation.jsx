import React from 'react';
import { Columns3, Calendar, Table, BarChart3 } from 'lucide-react';

export default function TabNavigation({ currentTab, onChangeTab }) {
  const tabs = [
    { id: 'kanban', label: 'Kanban Board', icon: Columns3 },
    { id: 'schedule', label: 'Visual Schedule Grid', icon: Calendar },
    { id: 'timesheet', label: 'Excel Timesheet Matrix', icon: Table },
    { id: 'analytics', label: 'SP & Sprint Analytics', icon: BarChart3 },
  ];

  return (
    <nav className="tabs-segmented-wrapper">
      <div className="tabs-segmented">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`tab-pill ${isActive ? 'active' : ''}`}
              onClick={() => onChangeTab(tab.id)}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
              {tab.badge && <span className="tab-badge">{tab.badge}</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
