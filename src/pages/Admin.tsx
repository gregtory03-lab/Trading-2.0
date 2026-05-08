import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Download,
  Eye,
  MessageSquare,
  Settings,
  Shield
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface KYCSubmission {
  id: string;
  user_id: string;
  status: string;
  document_type: string;
  front_document_url: string | null;
  back_document_url: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  notes: string | null;
  profiles: {
    first_name: string;
    last_name: string;
    phone_number: string;
  };
}

interface VerificationQuestion {
  id: string;
  user_id: string;
  question: string;
  answer: string | null;
  asked_at: string;
  answered_at: string | null;
  status: string;
  profiles: {
    first_name: string;
    last_name: string;
  };
}

interface UserProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  phone_number: string;
  address: string;
  created_at: string;
  user_roles: Array<{ role: string }>;
}

const Admin = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [kycSubmissions, setKycSubmissions] = useState<KYCSubmission[]>([]);
  const [questions, setQuestions] = useState<VerificationQuestion[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<KYCSubmission | null>(null);
  const [newQuestion, setNewQuestion] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  useEffect(() => {
    if (isAdmin) {
      fetchKYCSubmissions();
      fetchQuestions();
      fetchUsers();
    }
  }, [isAdmin]);

  const checkAdminStatus = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (error || data?.role !== 'admin') {
        toast({
          title: "Access Denied",
          description: "You don't have admin privileges.",
          variant: "destructive",
        });
        navigate('/dashboard');
        return;
      }
      
      setIsAdmin(true);
    } catch (error) {
      console.error('Error checking admin status:', error);
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchKYCSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('kyc_submissions')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      
      // Fetch profiles separately
      const submissionsWithProfiles = await Promise.all(
        (data || []).map(async (submission: any) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, phone_number')
            .eq('user_id', submission.user_id)
            .single();
          
          return { ...submission, profiles: profile };
        })
      );
      
      setKycSubmissions(submissionsWithProfiles);
    } catch (error) {
      console.error('Error fetching KYC submissions:', error);
    }
  };

  const fetchQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from('verification_questions')
        .select('*')
        .order('asked_at', { ascending: false });

      if (error) throw error;
      
      // Fetch profiles separately
      const questionsWithProfiles = await Promise.all(
        (data || []).map(async (question: any) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('user_id', question.user_id)
            .single();
          
          return { ...question, profiles: profile };
        })
      );
      
      setQuestions(questionsWithProfiles);
    } catch (error) {
      console.error('Error fetching questions:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch user roles separately
      const usersWithRoles = await Promise.all(
        (data || []).map(async (user: any) => {
          const { data: roles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.user_id);
          
          return { ...user, user_roles: roles || [] };
        })
      );
      
      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const updateKYCStatus = async (submissionId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('kyc_submissions')
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
          notes: reviewNotes,
          rejection_reason: status === 'rejected' ? rejectionReason : null
        })
        .eq('id', submissionId);

      if (error) throw error;

      toast({
        title: "Status Updated",
        description: `KYC submission ${status} successfully.`,
      });

      fetchKYCSubmissions();
      setSelectedSubmission(null);
      setReviewNotes('');
      setRejectionReason('');
    } catch (error) {
      console.error('Error updating KYC status:', error);
      toast({
        title: "Error",
        description: "Failed to update KYC status.",
        variant: "destructive",
      });
    }
  };

  const askQuestion = async (userId: string) => {
    if (!newQuestion.trim()) return;

    try {
      const { error } = await supabase
        .from('verification_questions')
        .insert({
          user_id: userId,
          question: newQuestion,
          asked_by: user?.id
        });

      if (error) throw error;

      toast({
        title: "Question Asked",
        description: "Verification question sent to user.",
      });

      setNewQuestion('');
      fetchQuestions();
    } catch (error) {
      console.error('Error asking question:', error);
      toast({
        title: "Error",
        description: "Failed to send question.",
        variant: "destructive",
      });
    }
  };

  const downloadDocument = async (url: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('kyc-documents')
        .download(url);

      if (error) throw error;

      const blob = new Blob([data]);
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = url.split('/').pop() || 'document';
      link.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error downloading document:', error);
      toast({
        title: "Error",
        description: "Failed to download document.",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-400',
      approved: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400',
      rejected: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400',
      under_review: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400'
    };
    
    return (
      <Badge className={variants[status as keyof typeof variants]}>
        {status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Admin Panel</span>
          </div>
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        <Tabs defaultValue="kyc" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="kyc" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              KYC Documents
            </TabsTrigger>
            <TabsTrigger value="questions" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Verification Questions
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              User Management
            </TabsTrigger>
          </TabsList>

          <TabsContent value="kyc" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>KYC Document Review</CardTitle>
                <CardDescription>Review and approve/reject user KYC submissions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {kycSubmissions.map((submission) => (
                    <div key={submission.id} className="border border-border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">
                            {submission.profiles?.first_name} {submission.profiles?.last_name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {submission.document_type} • Submitted {new Date(submission.submitted_at).toLocaleDateString()}
                          </p>
                        </div>
                        {getStatusBadge(submission.status)}
                      </div>
                      
                      <div className="flex gap-2 mb-3">
                        {submission.front_document_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadDocument(submission.front_document_url!)}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Front Document
                          </Button>
                        )}
                        {submission.back_document_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadDocument(submission.back_document_url!)}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Back Document
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedSubmission(submission)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Review
                        </Button>
                      </div>

                      {submission.notes && (
                        <p className="text-sm text-muted-foreground">
                          <strong>Notes:</strong> {submission.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {selectedSubmission && (
              <Card>
                <CardHeader>
                  <CardTitle>Review Submission</CardTitle>
                  <CardDescription>
                    {selectedSubmission.profiles?.first_name} {selectedSubmission.profiles?.last_name} - {selectedSubmission.document_type}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Review Notes</Label>
                    <Textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Add notes about this review..."
                      className="mt-1"
                    />
                  </div>

                  {selectedSubmission.status === 'pending' && (
                    <>
                      <div>
                        <Label>Rejection Reason (if rejecting)</Label>
                        <Textarea
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="Reason for rejection..."
                          className="mt-1"
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={() => updateKYCStatus(selectedSubmission.id, 'approved')}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          onClick={() => updateKYCStatus(selectedSubmission.id, 'rejected')}
                          variant="destructive"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                        <Button
                          onClick={() => updateKYCStatus(selectedSubmission.id, 'under_review')}
                          variant="outline"
                        >
                          <Clock className="h-4 w-4 mr-2" />
                          Mark Under Review
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="questions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Verification Questions</CardTitle>
                <CardDescription>Ask questions to users and view their responses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {questions.map((question) => (
                    <div key={question.id} className="border border-border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">
                          {question.profiles?.first_name} {question.profiles?.last_name}
                        </h3>
                        <Badge variant={question.status === 'answered' ? 'default' : 'secondary'}>
                          {question.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Asked on {new Date(question.asked_at).toLocaleDateString()}
                      </p>
                      <div className="bg-muted/50 p-3 rounded mb-2">
                        <p><strong>Question:</strong> {question.question}</p>
                      </div>
                      {question.answer && (
                        <div className="bg-primary/10 p-3 rounded">
                          <p><strong>Answer:</strong> {question.answer}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Answered on {new Date(question.answered_at!).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}

                  <Card className="mt-6">
                    <CardHeader>
                      <CardTitle>Ask New Question</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label>Question</Label>
                        <Textarea
                          value={newQuestion}
                          onChange={(e) => setNewQuestion(e.target.value)}
                          placeholder="Enter your verification question..."
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Select User</Label>
                        <select className="w-full mt-1 p-2 border border-border rounded-md bg-background">
                          <option value="">Select a user...</option>
                          {users.map((user) => (
                            <option key={user.user_id} value={user.user_id}>
                              {user.first_name} {user.last_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Button
                        onClick={() => {
                          const select = document.querySelector('select') as HTMLSelectElement;
                          if (select?.value) {
                            askQuestion(select.value);
                          }
                        }}
                        disabled={!newQuestion.trim()}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Send Question
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>View and manage user accounts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {users.map((userProfile) => (
                    <div key={userProfile.user_id} className="border border-border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="font-semibold">
                            {userProfile.first_name} {userProfile.last_name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Phone: {userProfile.phone_number || 'Not provided'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            DOB: {userProfile.date_of_birth || 'Not provided'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Address: {userProfile.address || 'Not provided'}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant={userProfile.user_roles?.[0]?.role === 'admin' ? 'default' : 'secondary'}>
                            {userProfile.user_roles?.[0]?.role || 'user'}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            Joined {new Date(userProfile.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const select = document.querySelector('select') as HTMLSelectElement;
                            if (select) select.value = userProfile.user_id;
                          }}
                        >
                          Ask Question
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;