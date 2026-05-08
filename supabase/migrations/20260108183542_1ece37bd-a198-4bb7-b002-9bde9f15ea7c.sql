-- Enable realtime for user_sessions table
ALTER TABLE public.user_sessions REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_sessions;