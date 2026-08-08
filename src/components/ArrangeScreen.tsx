'use client';

import { useState, useEffect } from 'react';
import { useCollage } from '@/store/collageStore';
import { GRID_SIZES, GridSize, gridDim } from '@/types/album';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import CoverImage from '@/components/CoverImage';

const SIZE_LABELS: Record<number, string> = {
  9: '3×3',
  16: '4×4',
  25: '5×5',
  36: '6×6',
  49: '7×7',
  64: '8×8',
  81: '9×9',
  100: '10×10',
};

// ── Desktop grid tile ────────────────────────────────────────────────────────

interface SortableTileProps {
  id: string;
  rank: number;
  coverUrl: string;
  title: string;
  artist: string;
  swapTarget: boolean;
  onSwapClick: () => void;
  onRemove: () => void;
}

function SortableTile({ id, rank, coverUrl, title, artist, swapTarget, onSwapClick, onRemove }: SortableTileProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={`relative aspect-square group ${swapTarget ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}`}
      onClick={swapTarget ? onSwapClick : undefined}
      {...(swapTarget ? {} : { ...attributes, ...listeners })}
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 pointer-events-none"
        style={{ width: 28, height: 10, background: 'rgba(243,234,214,0.75)', borderRadius: 1, transform: 'translateX(-50%) rotate(-1deg)', top: -4 }} />
      <div style={{ position: 'absolute', inset: 0, boxShadow: isDragging ? '0 8px 20px rgba(0,0,0,0.45)' : '1px 2px 5px rgba(0,0,0,0.3)' }} />
      <div className="absolute inset-0 overflow-hidden">
        <CoverImage src={coverUrl} alt={title} fill className="object-cover" title={title} artist={artist} />
        {swapTarget && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity" style={{ background: 'rgba(58,74,107,0.5)' }}>
            <span className="text-white text-xl font-bold">↓</span>
          </div>
        )}
      </div>
      {!swapTarget && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); if (window.confirm('Remove this album from the binder?')) onRemove(); }}
          className="absolute w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: '#d12b2b', color: '#fff', zIndex: 10, lineHeight: 1, top: -6, right: -6 }}
        >×</button>
      )}
      <div className="absolute top-2 left-2 font-pixel text-white leading-none pointer-events-none"
        style={{ fontSize: 9, background: 'rgba(0,0,0,0.72)', padding: '2px 4px', borderRadius: 2, zIndex: 5 }}>
        {rank}
      </div>
    </div>
  );
}

// ── Mobile list row ──────────────────────────────────────────────────────────

interface ListRowProps {
  id: string;
  rank: number;
  coverUrl: string;
  title: string;
  artist: string;
  onRemove: () => void;
}

function SortableListRow({ id, rank, coverUrl, title, artist, onRemove }: ListRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 50 : undefined, background: isDragging ? 'rgba(243,234,214,0.95)' : undefined }}
      className="flex items-center gap-3 py-1.5 px-2 rounded"
    >
      {/* rank */}
      <span className="font-pixel text-[10px] w-5 text-right flex-shrink-0" style={{ color: 'var(--denim)' }}>
        {rank}
      </span>
      {/* cover */}
      <div className="flex-shrink-0 overflow-hidden" style={{ width: 44, height: 44, borderRadius: 2, boxShadow: '1px 2px 5px rgba(0,0,0,0.3)' }}>
        <CoverImage src={coverUrl} alt={title} width={44} height={44} className="object-cover" title={title} artist={artist} />
      </div>
      {/* text */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold truncate" style={{ fontFamily: 'Verdana, Tahoma, sans-serif', color: '#171514' }}>{title}</div>
        <div className="text-xs truncate" style={{ fontFamily: 'Verdana, Tahoma, sans-serif', color: 'rgba(23,21,20,0.5)' }}>{artist}</div>
      </div>
      {/* remove */}
      <button
        onClick={() => { if (window.confirm('Remove this album from the binder?')) onRemove(); }}
        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
        style={{ color: 'rgba(23,21,20,0.3)', background: 'transparent' }}
      >×</button>
      {/* drag handle — listeners go here only, so scroll works everywhere else */}
      <div
        {...attributes}
        {...listeners}
        className="flex-shrink-0 flex items-center justify-center touch-none"
        style={{ width: 32, height: 44, cursor: 'grab', color: 'rgba(23,21,20,0.3)', fontSize: 18, userSelect: 'none' }}
        aria-label="drag to reorder"
      >
        ⠿
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function ArrangeScreen() {
  const { state, dispatch } = useCollage();
  const { tray, gridSize, gridOrder } = state;
  const [selectedExtra, setSelectedExtra] = useState<string | null>(null);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    setIsTouch(window.matchMedia('(hover: none) and (pointer: coarse)').matches);
  }, []);

  const desktopSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const mobileSensors = useSensors(
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  const albumMap = new Map(tray.map((a) => [a.id, a]));
  const orderedIds = [
    ...gridOrder.filter((id) => albumMap.has(id)),
    ...tray.map((a) => a.id).filter((id) => !gridOrder.includes(id)),
  ];
  const inGridIds = orderedIds.slice(0, gridSize);
  const extrasIds = orderedIds.slice(gridSize);
  const validSizes = GRID_SIZES.filter((s) => s <= tray.length || s === gridSize);
  const dim = gridDim(gridSize);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedIds.indexOf(active.id as string);
    const newIndex = orderedIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    dispatch({ type: 'REORDER_GRID', gridOrder: arrayMove(orderedIds, oldIndex, newIndex) });
  }

  function handleDesktopDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = inGridIds.indexOf(active.id as string);
    const newIndex = inGridIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    dispatch({ type: 'REORDER_GRID', gridOrder: [...arrayMove(inGridIds, oldIndex, newIndex), ...extrasIds] });
  }

  function handleExtraClick(extraId: string) {
    setSelectedExtra(selectedExtra === extraId ? null : extraId);
  }

  function handleGridSwap(gridId: string) {
    if (!selectedExtra) return;
    const newOrderedIds = [...orderedIds];
    const gridIdx = newOrderedIds.indexOf(gridId);
    const extraIdx = newOrderedIds.indexOf(selectedExtra);
    if (gridIdx === -1 || extraIdx === -1) return;
    newOrderedIds[gridIdx] = selectedExtra;
    newOrderedIds[extraIdx] = gridId;
    dispatch({ type: 'REORDER_GRID', gridOrder: newOrderedIds });
    setSelectedExtra(null);
  }

  const ctaButton = (
    <button
      onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'generate' })}
      className="btn-bevel"
      style={{ fontSize: 15, padding: '10px 24px', background: '#3a4a6b', color: '#fff', borderColor: '#1e2d4a', fontWeight: 'bold' }}
    >
      make the poster →
    </button>
  );

  const gridSizePicker = (
    <div>
      <div className="font-pixel text-[10px] mb-2" style={{ color: 'var(--denim)', letterSpacing: '0.05em' }}>
        how big&apos;s your wall?
      </div>
      <div className="flex flex-wrap gap-2">
        {validSizes.map((s) => (
          <div key={s} className="relative group">
            <button
              onClick={() => dispatch({ type: 'SET_GRID_SIZE', gridSize: s as GridSize })}
              className="btn-bevel"
              style={gridSize === s ? { background: 'var(--denim)', color: '#fff', borderColor: '#1e2d4a' } : {}}
            >
              {SIZE_LABELS[s]}
              {s === 100 && <span className="ml-1" style={{ fontSize: 9, opacity: 0.7 }}>the whole wall</span>}
            </button>
            {s === 9 && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded text-white font-pixel text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
                style={{ background: 'var(--ink)', zIndex: 10 }}>
                the Top 8 (+1) 😉
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // ── Mobile layout ──────────────────────────────────────────────────────────
  if (isTouch) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <div className="font-bold text-sm" style={{ fontFamily: 'Verdana, Tahoma, sans-serif', color: '#171514' }}>
            happy with the order?
          </div>
          <div className="text-xs mt-0.5" style={{ color: 'rgba(23,21,20,0.5)', fontFamily: 'Verdana, Tahoma, sans-serif' }}>
            hold ⠿ and drag to reorder
          </div>
        </div>

        {gridSizePicker}

        {/* Non-interactive grid preview */}
        <div>
          <div className="font-pixel text-[10px] mb-2" style={{ color: 'rgba(23,21,20,0.4)', letterSpacing: '0.04em' }}>
            preview
          </div>
          <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${dim}, 1fr)`, maxWidth: `${dim * 52}px` }}>
            {inGridIds.map((id) => {
              const album = albumMap.get(id);
              if (!album) return null;
              return (
                <div key={id} className="relative aspect-square overflow-hidden" style={{ borderRadius: 1 }}>
                  <CoverImage src={album.coverUrl} alt={album.title} fill className="object-cover" title={album.title} artist={album.artist} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Vertical drag list — all albums in order */}
        <div>
          <div className="font-pixel text-[10px] mb-1" style={{ color: 'rgba(23,21,20,0.4)', letterSpacing: '0.04em' }}>
            drag to reorder · {inGridIds.length} on wall{extrasIds.length > 0 ? ` · ${extrasIds.length} extra` : ''}
          </div>
          <DndContext sensors={mobileSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col divide-y" style={{ borderTop: '1px solid rgba(23,21,20,0.1)', borderBottom: '1px solid rgba(23,21,20,0.1)' }}>
                {orderedIds.map((id, i) => {
                  const album = albumMap.get(id);
                  if (!album) return null;
                  const isExtra = i >= gridSize;
                  return (
                    <div key={id} style={isExtra ? { opacity: 0.45 } : {}}>
                      <SortableListRow
                        id={id}
                        rank={i + 1}
                        coverUrl={album.coverUrl}
                        title={album.title}
                        artist={album.artist}
                        onRemove={() => dispatch({ type: 'REMOVE_ALBUM', id })}
                      />
                    </div>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
          {extrasIds.length > 0 && (
            <div className="text-xs mt-1.5 italic" style={{ color: 'rgba(23,21,20,0.4)', fontFamily: 'Verdana, Tahoma, sans-serif' }}>
              faded items are extras — drag them up to include on the wall
            </div>
          )}
        </div>

        <div className="flex justify-end">{ctaButton}</div>
      </div>
    );
  }

  // ── Desktop layout ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="font-bold text-sm" style={{ fontFamily: 'Verdana, Tahoma, sans-serif', color: '#171514' }}>
          happy with the order?
        </div>
        <div className="text-xs mt-0.5" style={{ color: 'rgba(23,21,20,0.5)', fontFamily: 'Verdana, Tahoma, sans-serif' }}>
          drag to rearrange · swap extras in by clicking them
        </div>
      </div>

      {gridSizePicker}

      <DndContext sensors={desktopSensors} collisionDetection={closestCenter} onDragEnd={handleDesktopDragEnd}>
        <SortableContext items={inGridIds} strategy={rectSortingStrategy}>
          <div className="grid gap-1.5 mt-1" style={{ gridTemplateColumns: `repeat(${dim}, 1fr)`, maxWidth: `${dim * 88}px` }}>
            {inGridIds.map((id, i) => {
              const album = albumMap.get(id);
              if (!album) return null;
              return (
                <SortableTile
                  key={id}
                  id={id}
                  rank={i + 1}
                  coverUrl={album.coverUrl}
                  title={album.title}
                  artist={album.artist}
                  swapTarget={!!selectedExtra}
                  onSwapClick={() => handleGridSwap(id)}
                  onRemove={() => dispatch({ type: 'REMOVE_ALBUM', id })}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {extrasIds.length > 0 && (
        <div>
          <div className="font-pixel text-[10px] mb-2" style={{ color: selectedExtra ? 'var(--red)' : 'rgba(23,21,20,0.45)', letterSpacing: '0.04em' }}>
            {selectedExtra ? 'now click a spot on the wall to swap it in' : 'extras — click one to swap into the wall'}
          </div>
          <div className="flex gap-2 flex-wrap">
            {extrasIds.map((id) => {
              const album = albumMap.get(id);
              if (!album) return null;
              const isSelected = selectedExtra === id;
              return (
                <button
                  key={id}
                  onClick={() => handleExtraClick(id)}
                  title={`${album.title} — ${album.artist}`}
                  className="relative overflow-hidden transition-all"
                  style={{
                    width: 56, height: 56, borderRadius: 2,
                    outline: isSelected ? '2px solid var(--ink)' : '1px solid rgba(23,21,20,0.2)',
                    outlineOffset: isSelected ? 2 : 0,
                    transform: isSelected ? 'scale(1.08)' : undefined,
                    boxShadow: '1px 2px 4px rgba(0,0,0,0.25)',
                  }}
                >
                  <CoverImage src={album.coverUrl} alt={album.title} fill className="object-cover" artist={album.artist} title={album.title} />
                  {isSelected && (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(23,21,20,0.45)' }}>
                      <span className="text-white font-bold text-base">↑</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex justify-end">{ctaButton}</div>
    </div>
  );
}
