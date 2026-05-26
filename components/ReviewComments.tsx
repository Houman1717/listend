import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  TextInput,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { ProBadge } from '@/components/ProBadge';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReviewComment = {
  id:               string;
  reviewId:         string;
  parentCommentId?: string | null;
  replyToUsername?: string | null;
  userId:           string;
  username:         string;
  avatarUrl?:       string | null;
  isPro?:           boolean;
  body:             string;
  createdAt:        string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function avatarColor(username: string): string {
  const palette = ['#D4A017', '#B8880F', '#D4A017', '#FF6B35', '#4CAF50', '#FFC107'];
  let hash = 0;
  for (const c of username) hash = (hash * 31 + c.charCodeAt(0)) % palette.length;
  return palette[Math.abs(hash)];
}

// ─── Comment bubble ───────────────────────────────────────────────────────────

export function CommentBubble({
  comment,
  isReply = false,
  large = false,
  isDark,
  colors,
  onReply,
  onUsernamePress,
}: {
  comment: ReviewComment;
  isReply?: boolean;
  large?: boolean;
  isDark: boolean;
  colors: { text: string; subtext: string; background: string };
  onReply: () => void;
  onUsernamePress?: (username: string) => void;
}) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const interactedRef = useRef(false);

  useEffect(() => {
    if (!comment.id) return;
    let cancelled = false;
    supabase
      .from('likes')
      .select('user_id')
      .eq('target_type', 'comment')
      .eq('target_id', comment.id)
      .then(({ data }) => {
        if (cancelled || interactedRef.current) return;
        const rows = (data ?? []) as any[];
        setLikeCount(rows.length);
        if (user?.id) setLiked(rows.some(r => r.user_id === user.id));
      });
    return () => { cancelled = true; };
  }, [comment.id, user?.id]);

  function handleLike() {
    if (!user) return;
    interactedRef.current = true;
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount(c => wasLiked ? c - 1 : c + 1);
    if (wasLiked) {
      supabase.from('likes').delete()
        .eq('user_id', user.id).eq('target_type', 'comment').eq('target_id', comment.id)
        .then(({ error }) => {
          if (error) { setLiked(true); setLikeCount(c => c + 1); }
        });
    } else {
      supabase.from('likes').insert({
        user_id: user.id, target_type: 'comment', target_id: comment.id, target_owner_id: comment.userId,
      }).then(({ error }) => {
        if (error) { setLiked(false); setLikeCount(c => Math.max(0, c - 1)); }
      });
    }
  }

  const avatarSize = large ? 32 : 22;
  const usernameSz = large ? 13 : 11;
  const dateSz     = large ? 12 : 10;
  const bodyTextSz = large ? 14 : 12;
  const bodyLineH  = large ? 21 : 17;
  const actionSz   = large ? 13 : 11;
  const heartSz    = large ? 13 : 11;
  const replyIndent = large ? 32 : 22;

  return (
    <View style={[cms.commentRow, isReply && [cms.replyRow, { marginLeft: replyIndent }], { borderBottomColor: isDark ? '#2a1e14' : '#f5e6c8', paddingVertical: large ? 12 : 8 }]}>
      {comment.avatarUrl ? (
        <ExpoImage
          source={{ uri: comment.avatarUrl }}
          style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, flexShrink: 0, marginTop: 1 }}
          contentFit="cover"
          cachePolicy="disk"
        />
      ) : (
        <View style={[cms.commentAvatar, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, backgroundColor: avatarColor(comment.username) }]}>
          <Text style={[cms.commentAvatarLetter, { fontSize: large ? 13 : 10 }]}>{comment.username[0].toUpperCase()}</Text>
        </View>
      )}
      <View style={cms.commentBody}>
        <View style={cms.commentTopLine}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Pressable onPress={() => onUsernamePress?.(comment.username)} hitSlop={4} disabled={!onUsernamePress}>
              <Text style={[cms.commentUsername, { fontSize: usernameSz }]}>@{comment.username}</Text>
            </Pressable>
            {comment.isPro && <ProBadge size="xs" />}
          </View>
          <Text style={[cms.commentDate, { color: colors.subtext, fontSize: dateSz }]}>{comment.createdAt}</Text>
        </View>
        {comment.replyToUsername && (
          <Text style={[cms.replyingToLabel, { color: colors.subtext, fontSize: large ? 11 : 9 }]}>
            replying to @{comment.replyToUsername}
          </Text>
        )}
        <Text style={[cms.commentText, { color: isDark ? '#a07850' : '#3a2818', fontSize: bodyTextSz, lineHeight: bodyLineH }]}>{comment.body}</Text>
        <View style={cms.commentActions}>
          <Pressable onPress={onReply} hitSlop={8} style={[cms.replyBtn, { borderColor: isDark ? '#5a3e28' : '#D4A017' }]}>
            <FontAwesome name="reply" size={large ? 11 : 9} color="#D4A017" />
            <Text style={[cms.replyBtnText, { fontSize: actionSz }]}>Reply</Text>
          </Pressable>
          <Pressable onPress={handleLike} hitSlop={6} style={cms.commentLikeBtn}>
            <FontAwesome
              name={liked ? 'heart' : 'heart-o'}
              size={heartSz}
              color={liked ? '#D4A017' : colors.subtext}
            />
            {likeCount > 0 && (
              <Text style={[cms.commentLikeCount, { color: liked ? '#D4A017' : colors.subtext, fontSize: actionSz }]}>
                {likeCount}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── Reply target state ───────────────────────────────────────────────────────

type ReplyTarget = {
  topLevelId:     string;
  targetId:       string;
  targetUsername: string;
};

// ─── Comments section ─────────────────────────────────────────────────────────

export function CommentsSection({
  comments,
  isDark,
  colors,
  onAddComment,
  onUsernamePress,
  large = false,
}: {
  comments: ReviewComment[];
  isDark: boolean;
  colors: { text: string; subtext: string; background: string };
  onAddComment?: (body: string, parentId?: string | null, username?: string, replyToUsername?: string, avatarUrl?: string | null) => void;
  onUsernamePress?: (username: string) => void;
  large?: boolean;
}) {
  const { user } = useAuth();
  const [myUsername, setMyUsername]         = useState('');
  const [myAvatarUrl, setMyAvatarUrl]       = useState<string | null>(null);
  const [replyTarget, setReplyTarget]       = useState<ReplyTarget | null>(null);
  const [replyText, setReplyText]           = useState('');
  const [commentText, setCommentText]       = useState('');
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('profiles').select('username, avatar_url').eq('id', user.id).single()
      .then(({ data }) => {
        if (data?.username)  setMyUsername(data.username);
        if (data?.avatar_url !== undefined) setMyAvatarUrl(data.avatar_url ?? null);
      });
  }, [user?.id]);

  const borderColor = isDark ? '#2a1e14' : '#f5e6c8';

  // Build parent → children map. All replies in a thread share the same
  // parentCommentId (the top-level comment id), so this map only has two
  // levels: null → top-level comments, and topLevel.id → its replies.
  const byParent = new Map<string | null, ReviewComment[]>();
  for (const c of comments) {
    const key = c.parentCommentId ?? null;
    byParent.set(key, [...(byParent.get(key) ?? []), c]);
  }
  const topLevel = byParent.get(null) ?? [];

  function submitReply() {
    if (!replyText.trim() || !replyTarget) return;
    onAddComment?.(
      replyText.trim(),
      replyTarget.topLevelId,
      myUsername || undefined,
      replyTarget.targetUsername,
      myAvatarUrl,
    );
    setReplyText('');
    setReplyTarget(null);
  }

  function submitComment() {
    if (!commentText.trim()) return;
    onAddComment?.(commentText.trim(), null, myUsername || undefined, undefined, myAvatarUrl);
    setCommentText('');
  }

  const inputFontSize = large ? 14 : 12;
  const inputPadV     = large ? 9  : 6;
  const sendIconSize  = large ? 15 : 13;

  // topLevelId propagates down so replies-to-replies still store
  // parentCommentId pointing at the thread root (keeping the list flat).
  function renderComment(comment: ReviewComment, depth: number, topLevelId?: string): React.ReactNode {
    const effectiveTopLevelId = topLevelId ?? comment.id;
    const children  = byParent.get(comment.id) ?? [];
    const isReply   = depth > 0;
    const replyIndent = depth > 0 ? (large ? 72 : 52) : (large ? 44 : 30);

    const INITIAL_SHOWN = 1;
    const isExpanded    = expandedReplies.has(comment.id);
    const visibleChildren = (depth === 0 && !isExpanded && children.length > INITIAL_SHOWN)
      ? children.slice(0, INITIAL_SHOWN)
      : children;
    const hiddenCount = children.length - INITIAL_SHOWN;

    const isReplyOpen = replyTarget?.targetId === comment.id;

    return (
      <View key={comment.id}>
        <CommentBubble
          comment={comment}
          isReply={isReply}
          large={large}
          isDark={isDark}
          colors={colors}
          onReply={() => {
            setReplyTarget(prev =>
              prev?.targetId === comment.id ? null : {
                topLevelId:     effectiveTopLevelId,
                targetId:       comment.id,
                targetUsername: comment.username,
              }
            );
            setReplyText('');
          }}
          onUsernamePress={onUsernamePress}
        />
        {isReplyOpen && (
          <View style={[cms.replyInputRow, { borderTopColor: borderColor, paddingLeft: replyIndent }]}>
            <TextInput
              style={[cms.replyInput, { color: colors.text, backgroundColor: isDark ? '#2e2018' : '#f5f5f5', borderColor: isDark ? '#2a1e14' : '#e0e0e0', fontSize: inputFontSize, paddingVertical: inputPadV }]}
              placeholder={`Reply to @${comment.username}…`}
              placeholderTextColor={colors.subtext}
              value={replyText}
              onChangeText={setReplyText}
              autoFocus
              maxLength={300}
              returnKeyType="send"
              onSubmitEditing={submitReply}
              blurOnSubmit={false}
            />
            <Pressable
              onPress={submitReply}
              hitSlop={8}
              style={[cms.sendBtn, { opacity: replyText.trim() ? 1 : 0.35 }]}>
              <FontAwesome name="send" size={sendIconSize} color="#D4A017" />
            </Pressable>
          </View>
        )}
        {/* Only one level of nesting in the UI — all replies are flat under
            the top-level comment, so we only recurse for depth 0. */}
        {depth === 0 && visibleChildren.map(child => renderComment(child, depth + 1, effectiveTopLevelId))}
        {depth === 0 && !isExpanded && hiddenCount > 0 && (
          <Pressable
            onPress={() => setExpandedReplies(prev => new Set([...prev, comment.id]))}
            hitSlop={6}
            style={[cms.showMoreReplies, { marginLeft: large ? 40 : 30 }]}>
            <FontAwesome name="comment-o" size={large ? 11 : 9} color={colors.subtext} />
            <Text style={[cms.showMoreRepliesText, { color: colors.subtext, fontSize: large ? 12 : 10 }]}>
              See {hiddenCount} more {hiddenCount === 1 ? 'reply' : 'replies'}
            </Text>
          </Pressable>
        )}
        {depth === 0 && isExpanded && hiddenCount > 0 && (
          <Pressable
            onPress={() => setExpandedReplies(prev => { const next = new Set(prev); next.delete(comment.id); return next; })}
            hitSlop={6}
            style={[cms.showMoreReplies, { marginLeft: large ? 40 : 30 }]}>
            <Text style={[cms.showMoreRepliesText, { color: colors.subtext, fontSize: large ? 12 : 10 }]}>
              See less
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={[cms.section, { borderTopColor: borderColor }]}>
      {topLevel.length === 0 ? (
        <Text style={[cms.emptyComments, { color: colors.subtext }]}>No comments yet. Be the first!</Text>
      ) : (
        topLevel.map(comment => renderComment(comment, 0))
      )}

      {/* New top-level comment */}
      <View style={[cms.newCommentRow, { borderTopColor: borderColor, marginTop: large ? 8 : 4, paddingTop: large ? 14 : 10 }]}>
        <TextInput
          style={[cms.commentInput, { flex: 1, color: colors.text, backgroundColor: isDark ? '#2e2018' : '#f5f5f5', borderColor: isDark ? '#2a1e14' : '#e0e0e0', fontSize: inputFontSize, paddingVertical: inputPadV }]}
          placeholder="Add a comment…"
          placeholderTextColor={colors.subtext}
          value={commentText}
          onChangeText={setCommentText}
          maxLength={300}
          returnKeyType="send"
          onSubmitEditing={submitComment}
          blurOnSubmit={false}
        />
        <Pressable
          onPress={submitComment}
          hitSlop={8}
          style={[cms.sendBtn, { opacity: commentText.trim() ? 1 : 0.35 }]}>
          <FontAwesome name="send" size={sendIconSize} color="#D4A017" />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const cms = StyleSheet.create({
  section: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    marginTop: 8,
  },
  emptyComments: {
    fontSize: 12,
    fontStyle: 'italic',
    paddingBottom: 8,
  },
  commentRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  replyRow: {
    marginLeft: 22,
    borderLeftWidth: 2,
    borderLeftColor: '#D4A017',
    paddingLeft: 8,
  },
  commentAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  commentAvatarLetter: { color: '#fff', fontSize: 10, fontWeight: '700' },
  commentBody: { flex: 1, gap: 3 },
  commentTopLine: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  commentUsername: { fontSize: 11, fontWeight: '700', color: '#D4A017' },
  commentDate: { fontSize: 10 },
  commentText: { fontSize: 12, lineHeight: 17 },
  commentActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  replyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  replyBtnText: { fontSize: 11, fontWeight: '700', color: '#D4A017' },
  commentLikeBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  commentLikeCount: { fontSize: 11 },

  replyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  replyInput: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
  },
  newCommentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  commentInput: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
  },
  sendBtn: { padding: 4 },
  replyingToLabel: { fontSize: 9, fontStyle: 'italic', marginBottom: 1 },
  showMoreReplies: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingBottom: 8 },
  showMoreRepliesText: { fontSize: 10, fontWeight: '600' },
});
