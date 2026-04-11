/**
 * SlideUpSheet — a reusable bottom sheet that slides up from the bottom.
 * Covers ~60% of the screen by default. Tap the backdrop or drag to dismiss.
 */
import React, { useEffect, useRef } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  Animated, Dimensions, PanResponder, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_H * 0.62;
const DRAG_CLOSE_THRESHOLD = 80;

interface SlideUpSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export default function SlideUpSheet({ visible, onClose, title, children }: SlideUpSheetProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SHEET_HEIGHT,
          duration: 240,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const dragY = useRef(new Animated.Value(0)).current;
  const dragStart = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderGrant: () => { dragStart.current = 0; },
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) dragY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DRAG_CLOSE_THRESHOLD) {
          onClose();
          dragY.setValue(0);
        } else {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true, tension: 80 }).start();
        }
      },
    })
  ).current;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { height: SHEET_HEIGHT + insets.bottom, paddingBottom: insets.bottom },
          { transform: [{ translateY: Animated.add(translateY, dragY) }] },
        ]}
      >
        <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.sheetInner}>
          {/* Drag handle */}
          <View {...panResponder.panHandlers} style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          {title && (
            <View style={styles.header}>
              <Text style={styles.headerTitle}>{title}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            </View>
          )}

          {/* Content */}
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentInner}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {children}
          </ScrollView>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  sheetInner: {
    flex: 1,
    backgroundColor: 'rgba(10,14,30,0.85)',
  },
  handleWrap: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F1F5F9',
    letterSpacing: 0.2,
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 20,
    paddingTop: 16,
  },
});
