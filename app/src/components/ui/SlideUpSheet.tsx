/**
 * SlideUpSheet — a reusable bottom sheet that slides up from the bottom.
 * Covers ~60% of the screen by default. Tap the backdrop or drag to dismiss.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  Animated, Easing, Dimensions, PanResponder, ScrollView,
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

// Ease-out expo — snappy start, graceful deceleration. Same curve iOS native sheets use.
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_IN_CUBIC = Easing.bezier(0.4, 0, 1, 1);

export default function SlideUpSheet({ visible, onClose, title, children }: SlideUpSheetProps) {
  const insets = useSafeAreaInsets();

  // Separate from the parent's `visible` — the Modal stays mounted through the
  // exit animation and only unmounts once it has fully slid away.
  const [modalMounted, setModalMounted] = useState(false);

  const translateY      = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetScale      = useRef(new Animated.Value(0.96)).current;
  const sheetOpacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Mount first, then animate in on the next tick
      setModalMounted(true);

      translateY.setValue(SHEET_HEIGHT);
      sheetScale.setValue(0.96);
      sheetOpacity.setValue(0);
      backdropOpacity.setValue(0);

      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 460,
          easing: EASE_OUT_EXPO,
          useNativeDriver: true,
        }),
        Animated.timing(sheetScale, {
          toValue: 1,
          duration: 460,
          easing: EASE_OUT_EXPO,
          useNativeDriver: true,
        }),
        Animated.timing(sheetOpacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    } else if (modalMounted) {
      // Animate out, then unmount the Modal once it's gone
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SHEET_HEIGHT,
          duration: 320,
          easing: EASE_IN_CUBIC,
          useNativeDriver: true,
        }),
        Animated.timing(sheetScale, {
          toValue: 0.96,
          duration: 300,
          easing: EASE_IN_CUBIC,
          useNativeDriver: true,
        }),
        Animated.timing(sheetOpacity, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 260,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => setModalMounted(false));
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
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 180,
            friction: 14,
          }).start();
        }
      },
    })
  ).current;

  return (
    <Modal visible={modalMounted} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { height: SHEET_HEIGHT + insets.bottom, paddingBottom: insets.bottom },
          {
            opacity: sheetOpacity,
            transform: [
              { translateY: Animated.add(translateY, dragY) },
              { scale: sheetScale },
            ],
          },
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
