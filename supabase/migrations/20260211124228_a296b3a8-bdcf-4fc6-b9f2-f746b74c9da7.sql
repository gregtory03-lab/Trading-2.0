-- Allow users to delete their own messages (only user-sent ones)
CREATE POLICY "Users can delete their own messages"
ON public.chat_messages
FOR DELETE
USING (auth.uid() = user_id AND sender_type = 'user');