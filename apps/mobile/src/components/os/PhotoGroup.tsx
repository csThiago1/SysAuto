import React from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '@/components/ui/Text';
import { Colors, Radii } from '@/constants/theme';
import { FOLDER_LABELS } from '@/components/os/os-detail-utils';
import type { OSPhoto, OSLineItem } from '@/components/os/os-detail-utils';
import { MonoLabel } from '@/components/ui/MonoLabel';
import { formatCurrency } from '@/components/os/os-detail-utils';

// ─── PhotoGroup ────────────────────────────────────────────────────────────

export interface PhotoGroupProps {
  folder: string;
  photos: OSPhoto[];
  onPhotoPress: (url: string) => void;
}

export function PhotoGroup({ folder, photos, onPhotoPress }: PhotoGroupProps): React.JSX.Element {
  const label = FOLDER_LABELS[folder] ?? folder;

  return (
    <View style={styles.photoGroup}>
      <Text variant="bodySmall" style={styles.photoGroupTitle}>
        {label}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
        {photos.map((photo) => (
          <TouchableOpacity
            key={photo.id}
            onPress={() => onPhotoPress(photo.url)}
            activeOpacity={0.85}
            style={styles.photoWrapper}
          >
            <Image
              source={{ uri: photo.url }}
              style={styles.photo}
              resizeMode="cover"
            />
            {photo.caption != null && photo.caption.length > 0 && (
              <Text variant="caption" color={Colors.textTertiary} numberOfLines={1} style={styles.photoCaption}>
                {photo.caption}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── LineItemRow ───────────────────────────────────────────────────────────

export interface LineItemRowProps {
  item: OSLineItem;
}

export function LineItemRow({ item }: LineItemRowProps): React.JSX.Element {
  return (
    <View style={styles.lineItemRow}>
      <View style={styles.lineItemInfo}>
        <Text variant="bodySmall" color={Colors.textPrimary} numberOfLines={2}>
          {item.description}
        </Text>
        <Text variant="bodySmall" color={Colors.textPrimary}>
          {item.quantity}x {formatCurrency(item.unit_price)}
        </Text>
      </View>
      <MonoLabel variant="accent">{formatCurrency(item.total)}</MonoLabel>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // PhotoGroup
  photoGroup: {
    paddingTop: 14,
    paddingBottom: 8,
  },
  photoGroupTitle: {
    fontWeight: '700',
    paddingHorizontal: 16,
    marginBottom: 8,
    color: Colors.textPrimary,
  },
  photoScroll: {
    paddingLeft: 16,
  },
  photoWrapper: {
    marginRight: 10,
    alignItems: 'center',
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: Radii.sm,
    backgroundColor: Colors.skeleton,
  },
  photoCaption: {
    marginTop: 4,
    maxWidth: 120,
  },

  // LineItemRow
  lineItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 4,
  },
  lineItemInfo: {
    flex: 1,
    gap: 2,
  },
});
