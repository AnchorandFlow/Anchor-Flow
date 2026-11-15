// src/components/settingsPillContext.js — af_redesign Settings pill tabs.
// SettingsTab provides { active: sectionId }; Section (./Section.jsx) renders
// only the active section. No provider (flag off): the accordion, unchanged.
import { createContext } from "react";

export var SettingsPillContext = createContext(null);
