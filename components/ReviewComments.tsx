import { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  TextInput,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReviewComment = {
  id:               string;
  reviewId:         string;
  parentCommentId?: string | null;
  userId:           string;
  username:         string;
  body:             string;
  createdAt:        string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function avatarColor(username: string): string {
  const palette = ['#FF3CAC', '#7B61FF', '#00BCD4', '#FF6B35', '#4CAF50', '#FFC107'];
  let hash = 0;
  for (const c of username) hash = (hash * 31 + c.charCodeAt(0)) % palette.length;
  return palette[Math.abs(hash)];
}

// ─── Comment bubble ───────────────────────────────────────────────────────────

export function CommentBubble({
  comment,
  isReply = false,
  isDark,
  colors,
  onReply,
}: {
  comment: ReviewComment;
  isReply?: boolean;
  isDark: boolean;
  colors: { text: string; subtext: string; background: string };
  onReply: () => void;
}) {
  return (
    <View style={[cms.commentRow, isReply && cms.replyRow, { borderBottomColor: isDark ? '#1f1f1f' : '#f0f0f0' }]}>
      <View style={[cms.commentAvatar, { backgroundColor: avatarColor(comment.username) }]}>
        <Text style={cms.commentAvatarLetter}>{comment.username[0].toUpperCase()}</Text>
      </View>
      <View style={cms.commentBody}>
        <View style={cms.commentTopLine}>
          <Text style={cms.commentUsername}>@{comment.username}</Text>
          <Text style={[cms.commentDate, { color: colors.subtext }]}>{comment.createdAt}</Text>
        </View>
        <Text style={[cms.commentText, { color: isDark ? '#ccc' : '#333' }]}>{comment.body}</Text>
        <Pressable onPress={onReply} hitSlop={6}>
          <Text style={[cms.replyLabel, { color: colors.subtext }]}>Reply</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Comments section ─────────────────────────────────────────────────────────

export function CommentsSection({
  comments,
  isDark,
  colors,
  onAddComment,
}: {
  comments: ReviewComment[];
  isDark: boolean;
  colors: { text: string; subtext: string; background: string };
  onAddComment?: (body: string, parentId?: string | null) => void;
}) {
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText]       = useState('');
  const [commentText, setCommentText]   = useState('');

  const topLevel   = comments.filter(c => !c.parentCommentId);
  const repliesFor = (id: string) => comments.filter(c => c.parentCommentId === id);
  const borderColor = isDark ? '#1f1f1f' : '#f0f0f0';

  function submitReply(parentId: string) {
    if (!replyText.trim()) return;
    onAddComment?.(replyText.trim(), parentId);
    setReplyText('');
    setReplyingToId(null);
  }

  function submitComment() {
    if (!commentText.trim()) return;
    onAddComment?.(commentText.trim(), null);
    setCommentText('');
  }

  return (
    <View style={[cms.section, { borderTopColor: borderColor }]}>
      {topLevel.length === 0 ? (
        <Text style={[cms.emptyComments, { color: colors.subtext }]}>No comments yet. Be the first!</Text>
      ) : (
        topLevel.map(comment => (
          <View key={comment.id}>
            <CommentBubble
              comment={comment}
              isDark={isDark}
              colors={colors}
              onReply={() => setReplyingToId(prev => prev === comment.id ? null : comment.id)}
            />
            {repliesFor(comment.id).map(reply => (
              <CommentBubble
                key={reply.id}
                comment={reply}
                isReply
                isDark={isDark}
                colors={colors}
                onReply={() => setReplyingToId(comment.id)}
              />
            ))}
            {replyingToId === comment.id && (
              <View style={[cms.replyInputRow, { borderTopColor: borderColor }]}>
                <TextInput
                  style={[cms.replyInput, { color: colors.text, backgroundColor: isDark ? '#1e1e1e' : '#f5f5f5', borderColor: isDark ? '#2e2e2e' : '#e0e0e0' }]}
                  placeholder={`Reply to @${comment.username}…`}
                  placeholderTextColor={colors.subtext}
                  value={replyText}
                  onChangeText={setReplyText}
                  autoFocus
                  maxLength={300}
                  returnKeyType="send"
                  onSubmitEditing={() => submitReply(comment.id)}
                  blurOnSubmit={false}
                />
                <Pressable
                  onPress={() => submitReply(comment.id)}
                  hitSlop={8}
                  style={[cms.sendBtn, { opacity: replyText.trim() ? 1 : 0.35 }]}>
                  <FontAwesome name="send" size={13} color="#FF3CAC" />
                </Pressable>
              </View>
            )}
          </View>
        ))
      )}

      {/* New top-level comment */}
      <View style={[cms.newCommentRow, { borderTopColor: borderColor }]}>
        <TextInput
          style={[cms.commentInput, { flex: 1, color: colors.text, backgroundColor: isDark ? '#1e1e1e' : '#f5f5f5', borderColor: isDark ? '#2e2e2e' : '#e0e0e0' }]}
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
          <FontAwesome name="send" size={13} color="#FF3CAC" />
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
    borderLeftColor: '#FF3CAC',
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
  commentUsername: { fontSize: 11, fontWeight: '700', color: '#FF3CAC' },
  commentDate: { fontSize: 10 },
  commentText: { fontSize: 12, lineHeight: 17 },
  replyLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },

  replyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    paddingLeft: 30,
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
});
