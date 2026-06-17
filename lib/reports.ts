import { Alert } from 'react-native';
import { supabase } from './supabase';

export type ReportContentType = 'review' | 'comment' | 'user' | 'dm' | 'playlist';

const REASONS = [
  'Hate speech or harassment',
  'Spam or misleading',
  'Sexual or explicit content',
  'Violence or dangerous content',
  'Other',
];

async function submitReport(params: {
  contentType: ReportContentType;
  contentId: string;
  reportedUser?: string | null;
  reason: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    Alert.alert('Sign in required', 'Please sign in to report content.');
    return;
  }

  const { error } = await supabase.from('content_reports').insert({
    reporter_id:   user.id,
    reported_user: params.reportedUser ?? null,
    content_type:  params.contentType,
    content_id:    params.contentId,
    reason:        params.reason,
  });

  // Duplicate report (unique index) — treat as already-reported, not an error
  if (error && !error.message.toLowerCase().includes('duplicate')) {
    console.error('[reports] insert error:', error.message);
    Alert.alert('Could not submit', 'Something went wrong. Please try again.');
    return;
  }

  Alert.alert(
    'Report received',
    'Thanks for letting us know. Our team reviews reports within 24 hours and will remove content or remove users that violate our rules.'
  );
}

/**
 * Presents a reason picker, then files a content report.
 * Required by App Store guideline 1.2 (user-generated content moderation).
 */
export function reportContent(params: {
  contentType: ReportContentType;
  contentId: string;
  reportedUser?: string | null;
  label?: string;
}) {
  Alert.alert(
    'Report',
    `Why are you reporting this ${params.label ?? params.contentType}?`,
    [
      ...REASONS.map(reason => ({
        text: reason,
        onPress: () =>
          submitReport({
            contentType:  params.contentType,
            contentId:    params.contentId,
            reportedUser: params.reportedUser,
            reason,
          }),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]
  );
}
