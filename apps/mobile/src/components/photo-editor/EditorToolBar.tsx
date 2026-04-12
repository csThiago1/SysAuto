// apps/mobile/src/components/photo-editor/EditorToolBar.tsx
import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import type { AnnotationTool, AnnotationColor } from '@/stores/photo.store';

// ─── Color dot ────────────────────────────────────────────────────────────────

interface ColorDotProps {
  color: AnnotationColor;
  isActive: boolean;
  onPress: () => void;
}

function ColorDot({ color, isActive, onPress }: ColorDotProps): React.ReactElement {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="radio"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={`Cor ${color}`}
      style={[
        styles.colorDot,
        { backgroundColor: color === '#ffffff' ? '#e5e7eb' : color },
        isActive && styles.colorDotActive,
      ]}
    />
  );
}

// ─── Tool button ──────────────────────────────────────────────────────────────

interface ToolButtonProps {
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  isActive: boolean;
  onPress: () => void;
}

function ToolButton({ iconName, label, isActive, onPress }: ToolButtonProps): React.ReactElement {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="radio"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={label}
      style={[styles.toolButton, isActive && styles.toolButtonActive]}
    >
      <Ionicons name={iconName} size={22} color={isActive ? '#ffffff' : '#374151'} />
      <Text variant="caption" style={[styles.toolLabel, isActive && styles.toolLabelActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface EditorToolBarProps {
  activeTool: AnnotationTool;
  activeColor: AnnotationColor;
  canUndo: boolean;
  canRedo: boolean;
  isSaving: boolean;
  onToolChange: (tool: AnnotationTool) => void;
  onColorChange: (color: AnnotationColor) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
}

const COLORS: AnnotationColor[] = ['#e31b1b', '#facc15', '#ffffff'];

export function EditorToolBar({
  activeTool,
  activeColor,
  canUndo,
  canRedo,
  isSaving,
  onToolChange,
  onColorChange,
  onUndo,
  onRedo,
  onSave,
}: EditorToolBarProps): React.ReactElement {
  return (
    <View style={styles.container}>
      {/* Row 1: Tools + Undo/Redo */}
      <View style={styles.toolsRow}>
        <ToolButton
          iconName="arrow-forward-outline"
          label="Seta"
          isActive={activeTool === 'arrow'}
          onPress={() => onToolChange('arrow')}
        />
        <ToolButton
          iconName="ellipse-outline"
          label="Círculo"
          isActive={activeTool === 'circle'}
          onPress={() => onToolChange('circle')}
        />
        <ToolButton
          iconName="text-outline"
          label="Texto"
          isActive={activeTool === 'text'}
          onPress={() => onToolChange('text')}
        />

        <View style={styles.separator} />

        {/* Color picker */}
        <View style={styles.colorRow} accessibilityRole="radiogroup" accessibilityLabel="Cor da anotação">
          {COLORS.map((c) => (
            <ColorDot
              key={c}
              color={c}
              isActive={activeColor === c}
              onPress={() => onColorChange(c)}
            />
          ))}
        </View>

        <View style={styles.separator} />

        {/* Undo / Redo */}
        <TouchableOpacity
          onPress={onUndo}
          disabled={!canUndo}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Desfazer"
          accessibilityState={{ disabled: !canUndo }}
          style={[styles.iconButton, !canUndo && styles.iconButtonDisabled]}
        >
          <Ionicons name="arrow-undo-outline" size={22} color={canUndo ? '#374151' : '#d1d5db'} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onRedo}
          disabled={!canRedo}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Refazer"
          accessibilityState={{ disabled: !canRedo }}
          style={[styles.iconButton, !canRedo && styles.iconButtonDisabled]}
        >
          <Ionicons name="arrow-redo-outline" size={22} color={canRedo ? '#374151' : '#d1d5db'} />
        </TouchableOpacity>
      </View>

      {/* Save button */}
      <TouchableOpacity
        onPress={onSave}
        disabled={isSaving}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={isSaving ? 'Salvando anotações' : 'Salvar anotações'}
        accessibilityState={{ disabled: isSaving }}
        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
      >
        {isSaving ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Ionicons name="checkmark" size={20} color="#ffffff" />
        )}
        <Text variant="label" style={styles.saveLabel}>
          {isSaving ? 'Salvando...' : 'Salvar anotações'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  toolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 2,
    backgroundColor: '#f3f4f6',
  },
  toolButtonActive: {
    backgroundColor: '#e31b1b',
  },
  toolLabel: {
    color: '#374151',
    fontSize: 10,
  },
  toolLabelActive: {
    color: '#ffffff',
  },
  separator: {
    width: 1,
    height: 32,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 2,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotActive: {
    borderColor: '#374151',
    transform: [{ scale: 1.2 }],
  },
  iconButton: {
    padding: 6,
    borderRadius: 8,
  },
  iconButtonDisabled: {
    opacity: 0.4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#e31b1b',
    paddingVertical: 13,
    borderRadius: 14,
    minHeight: 50,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveLabel: {
    color: '#ffffff',
  },
});
