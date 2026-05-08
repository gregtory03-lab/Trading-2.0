import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  Shield, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Upload, 
  FileText, 
  User, 
  CreditCard, 
  ChevronRight,
  Loader2,
  X,
  Eye
} from 'lucide-react';
import CryptoDashboardLayout from '@/components/CryptoDashboardLayout';
import { Progress } from '@/components/ui/progress';

type Step = 'personal' | 'documents' | 'review';

const KYC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<Step>('personal');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    address: '',
    phoneNumber: ''
  });
  const [documentType, setDocumentType] = useState('passport');
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [kycSubmissions, setKycSubmissions] = useState<any[]>([]);
  const [hasSubmittedKYC, setHasSubmittedKYC] = useState(false);
  const [kycStatus, setKycStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  const loadUserData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadUserProfile(), loadKYCSubmissions()]);
    } finally {
      setLoading(false);
    }
  };

  const loadUserProfile = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (data) {
        setFormData({
          firstName: data.first_name || '',
          lastName: data.last_name || '',
          dateOfBirth: data.date_of_birth || '',
          address: data.address || '',
          phoneNumber: data.phone_number || ''
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadKYCSubmissions = async () => {
    try {
      const { data } = await supabase
        .from('kyc_submissions')
        .select('*')
        .eq('user_id', user?.id)
        .order('submitted_at', { ascending: false });

      if (data && data.length > 0) {
        setKycSubmissions(data);
        setHasSubmittedKYC(true);
        const latestSubmission = data[0];
        setKycStatus(latestSubmission.status as 'pending' | 'approved' | 'rejected');
      }
    } catch (error) {
      console.error('Error loading KYC submissions:', error);
    }
  };

  const handleFileChange = (file: File | null, type: 'front' | 'back') => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'front') {
          setFrontFile(file);
          setFrontPreview(reader.result as string);
        } else {
          setBackFile(file);
          setBackPreview(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    } else {
      if (type === 'front') {
        setFrontFile(null);
        setFrontPreview(null);
      } else {
        setBackFile(null);
        setBackPreview(null);
      }
    }
  };

  const uploadDocument = async (file: File, type: 'front' | 'back') => {
    if (!user) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${documentType}_${type}_${Date.now()}.${fileExt}`;
    
    const { error } = await supabase.storage
      .from('kyc-documents')
      .upload(fileName, file);

    if (error) throw error;
    return fileName;
  };

  const handleSubmit = async () => {
    if (!user) return;

    setUploading(true);
    try {
      // Update or insert profile
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      const profileData = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        date_of_birth: formData.dateOfBirth,
        address: formData.address,
        phone_number: formData.phoneNumber
      };

      const { error: profileError } = existingProfile
        ? await supabase.from('profiles').update(profileData).eq('user_id', user.id)
        : await supabase.from('profiles').insert({ ...profileData, user_id: user.id });

      if (profileError) throw profileError;

      // Upload documents
      let frontUrl = null;
      let backUrl = null;

      if (frontFile) {
        frontUrl = await uploadDocument(frontFile, 'front');
      }
      if (backFile) {
        backUrl = await uploadDocument(backFile, 'back');
      }

      // Create KYC submission
      const { error: kycError } = await supabase
        .from('kyc_submissions')
        .insert({
          user_id: user.id,
          document_type: documentType,
          front_document_url: frontUrl,
          back_document_url: backUrl,
          status: 'pending'
        });

      if (kycError) throw kycError;

      toast({
        title: "KYC Submitted Successfully",
        description: "Your documents are now under review. This typically takes 1-2 business days.",
      });

      loadKYCSubmissions();
      setFrontFile(null);
      setBackFile(null);
      setFrontPreview(null);
      setBackPreview(null);
    } catch (error: any) {
      console.error('Error submitting KYC:', error);
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit KYC information.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const isPersonalInfoComplete = formData.firstName && formData.lastName && formData.dateOfBirth;
  const isDocumentsComplete = frontFile && (documentType === 'passport' || backFile);

  const getStepProgress = () => {
    if (hasSubmittedKYC) return 100;
    if (currentStep === 'personal') return 33;
    if (currentStep === 'documents') return 66;
    return 100;
  };

  const steps = [
    { id: 'personal', label: 'Personal Info', icon: User },
    { id: 'documents', label: 'Documents', icon: CreditCard },
    { id: 'review', label: 'Review & Submit', icon: CheckCircle },
  ];

  if (loading) {
    return (
      <CryptoDashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </CryptoDashboardLayout>
    );
  }

  // Show status page if KYC already submitted
  if (hasSubmittedKYC) {
    return (
      <CryptoDashboardLayout>
        <div className="space-y-6 p-6 max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 rounded-full bg-primary/10">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">KYC Verification</h1>
              <p className="text-muted-foreground">Identity verification status</p>
            </div>
          </div>

          {/* Status Card */}
          <Card className="border-2 overflow-hidden">
            <div className={`h-2 ${
              kycStatus === 'approved' ? 'bg-green-500' : 
              kycStatus === 'rejected' ? 'bg-red-500' : 
              'bg-yellow-500'
            }`} />
            <CardContent className="pt-8 pb-8">
              <div className="flex flex-col items-center text-center">
                {kycStatus === 'approved' && (
                  <>
                    <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center mb-4">
                      <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-green-600 dark:text-green-400 mb-2">Verified</h2>
                    <p className="text-muted-foreground max-w-md">
                      Your identity has been successfully verified. You now have full access to all platform features.
                    </p>
                  </>
                )}
                {kycStatus === 'pending' && (
                  <>
                    <div className="w-20 h-20 rounded-full bg-yellow-100 dark:bg-yellow-950 flex items-center justify-center mb-4">
                      <Clock className="h-10 w-10 text-yellow-600 dark:text-yellow-400 animate-pulse" />
                    </div>
                    <h2 className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mb-2">Under Review</h2>
                    <p className="text-muted-foreground max-w-md">
                      Your documents are being reviewed by our verification team. This process typically takes 1-2 business days.
                    </p>
                  </>
                )}
                {kycStatus === 'rejected' && (
                  <>
                    <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center mb-4">
                      <AlertCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">Verification Failed</h2>
                    <p className="text-muted-foreground max-w-md mb-4">
                      Unfortunately, we couldn't verify your identity. Please review the reason below and resubmit your documents.
                    </p>
                    {kycSubmissions[0]?.rejection_reason && (
                      <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 w-full max-w-md">
                        <p className="text-sm font-medium text-red-800 dark:text-red-300">
                          Reason: {kycSubmissions[0].rejection_reason}
                        </p>
                      </div>
                    )}
                    <Button 
                      className="mt-6"
                      onClick={() => {
                        setHasSubmittedKYC(false);
                        setKycStatus('none');
                        setCurrentStep('personal');
                      }}
                    >
                      Submit New Documents
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Submission History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Submission History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {kycSubmissions.map((submission, index) => (
                  <div key={submission.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium capitalize">{submission.document_type}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(submission.submitted_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                    <Badge className={
                      submission.status === 'approved' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400 border-green-200 dark:border-green-800'
                        : submission.status === 'rejected'
                        ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400 border-red-200 dark:border-red-800'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'
                    }>
                      {submission.status === 'pending' ? 'Under Review' : submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </CryptoDashboardLayout>
    );
  }

  return (
    <CryptoDashboardLayout>
      <div className="space-y-6 p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-full bg-primary/10">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">KYC Verification</h1>
            <p className="text-muted-foreground">Complete your identity verification to unlock all features</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = steps.findIndex(s => s.id === currentStep) > index;
              
              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all ${
                      isActive 
                        ? 'bg-primary border-primary text-primary-foreground' 
                        : isCompleted 
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'bg-muted border-border text-muted-foreground'
                    }`}>
                      {isCompleted ? <CheckCircle className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
                    </div>
                    <span className={`text-sm mt-2 font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                      {step.label}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`flex-1 h-1 mx-4 rounded ${isCompleted ? 'bg-green-500' : 'bg-border'}`} />
                  )}
                </div>
              );
            })}
          </div>
          <Progress value={getStepProgress()} className="h-2" />
        </div>

        {/* Step Content */}
        {currentStep === 'personal' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
              <CardDescription>
                Please provide your legal name as it appears on your identity documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    placeholder="John"
                    value={formData.firstName}
                    onChange={(e) => setFormData(prev => ({...prev, firstName: e.target.value}))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={(e) => setFormData(prev => ({...prev, lastName: e.target.value}))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData(prev => ({...prev, dateOfBirth: e.target.value}))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData(prev => ({...prev, phoneNumber: e.target.value}))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  placeholder="123 Main St, City, State, ZIP"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({...prev, address: e.target.value}))}
                />
              </div>

              <div className="flex justify-end pt-4">
                <Button 
                  onClick={() => setCurrentStep('documents')}
                  disabled={!isPersonalInfoComplete}
                  className="gap-2"
                >
                  Continue to Documents
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 'documents' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Identity Documents
              </CardTitle>
              <CardDescription>
                Upload a clear photo of your government-issued ID
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Document Type</Label>
                <div className="grid grid-cols-3 gap-3">
                  {['passport', 'license', 'id'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setDocumentType(type)}
                      className={`p-4 rounded-lg border-2 text-center transition-all ${
                        documentType === type 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <p className="font-medium capitalize">
                        {type === 'id' ? 'National ID' : type === 'license' ? "Driver's License" : 'Passport'}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Front Side Upload */}
                <div className="space-y-2">
                  <Label>Front Side *</Label>
                  <div className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                    frontPreview ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-border hover:border-primary/50'
                  }`}>
                    {frontPreview ? (
                      <div className="relative">
                        <img src={frontPreview} alt="Front document" className="max-h-40 mx-auto rounded-lg" />
                        <button
                          onClick={() => handleFileChange(null, 'front')}
                          className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full text-white hover:bg-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                        <p className="text-sm text-muted-foreground mb-2">
                          Click or drag to upload
                        </p>
                        <p className="text-xs text-muted-foreground">
                          JPG, PNG or PDF (max 10MB)
                        </p>
                      </>
                    )}
                    <input
                      type="file"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      accept="image/jpeg,image/jpg,image/png,.pdf"
                      onChange={(e) => handleFileChange(e.target.files?.[0] || null, 'front')}
                    />
                  </div>
                </div>

                {/* Back Side Upload */}
                <div className="space-y-2">
                  <Label>Back Side {documentType === 'passport' ? '(Optional)' : '*'}</Label>
                  <div className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                    backPreview ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-border hover:border-primary/50'
                  }`}>
                    {backPreview ? (
                      <div className="relative">
                        <img src={backPreview} alt="Back document" className="max-h-40 mx-auto rounded-lg" />
                        <button
                          onClick={() => handleFileChange(null, 'back')}
                          className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full text-white hover:bg-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                        <p className="text-sm text-muted-foreground mb-2">
                          Click or drag to upload
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {documentType === 'passport' ? 'Optional for passport' : 'JPG, PNG or PDF (max 10MB)'}
                        </p>
                      </>
                    )}
                    <input
                      type="file"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      accept="image/jpeg,image/jpg,image/png,.pdf"
                      onChange={(e) => handleFileChange(e.target.files?.[0] || null, 'back')}
                    />
                  </div>
                </div>
              </div>

              {/* Requirements */}
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="font-medium text-blue-800 dark:text-blue-300 mb-2">Document Requirements</p>
                <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Clear, high-resolution image</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> All text must be readable</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> No glare or shadows</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Document must be valid and unexpired</li>
                </ul>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setCurrentStep('personal')}>
                  Back
                </Button>
                <Button 
                  onClick={() => setCurrentStep('review')}
                  disabled={!isDocumentsComplete}
                  className="gap-2"
                >
                  Continue to Review
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 'review' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Review & Submit
              </CardTitle>
              <CardDescription>
                Please review your information before submitting
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Personal Info Summary */}
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Personal Information
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => setCurrentStep('personal')}>
                    Edit
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Full Name</p>
                    <p className="font-medium">{formData.firstName} {formData.lastName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Date of Birth</p>
                    <p className="font-medium">{new Date(formData.dateOfBirth).toLocaleDateString()}</p>
                  </div>
                  {formData.phoneNumber && (
                    <div>
                      <p className="text-muted-foreground">Phone</p>
                      <p className="font-medium">{formData.phoneNumber}</p>
                    </div>
                  )}
                  {formData.address && (
                    <div>
                      <p className="text-muted-foreground">Address</p>
                      <p className="font-medium">{formData.address}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Documents Summary */}
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Documents
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => setCurrentStep('documents')}>
                    Edit
                  </Button>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-muted-foreground text-sm">Document Type</p>
                    <p className="font-medium capitalize">
                      {documentType === 'id' ? 'National ID' : documentType === 'license' ? "Driver's License" : 'Passport'}
                    </p>
                  </div>
                  <div className="flex gap-4">
                    {frontPreview && (
                      <div>
                        <p className="text-muted-foreground text-sm mb-1">Front</p>
                        <img src={frontPreview} alt="Front" className="h-24 rounded-lg border border-border" />
                      </div>
                    )}
                    {backPreview && (
                      <div>
                        <p className="text-muted-foreground text-sm mb-1">Back</p>
                        <img src={backPreview} alt="Back" className="h-24 rounded-lg border border-border" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Terms */}
              <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                <p>
                  By submitting this verification, you confirm that all information provided is accurate and that 
                  you agree to our Terms of Service and Privacy Policy. Your data will be securely processed and 
                  stored in compliance with applicable regulations.
                </p>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setCurrentStep('documents')}>
                  Back
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={uploading}
                  className="gap-2 min-w-[180px]"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Submit Verification
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </CryptoDashboardLayout>
  );
};

export default KYC;