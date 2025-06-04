import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Plus, Eye, Image, Home, Wrench, Users, Award } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import CloudinaryPhotoManager from "@/components/cloudinary-photo-manager";

interface ProjectForm {
  title: string;
  description: string;
  imageUrl: string;
  category: string;
  location: string;
}

interface WebsiteImages {
  // Hero Section
  heroBackground: string;
  
  // Services Section
  residentialRoofingImage: string;
  roofRepairImage: string;
  roofInspectionImage: string;
  gutterServiceImage: string;
  stormDamageImage: string;
  paintingServiceImage: string;
  
  // About Section
  teamPhoto: string;
  visionImage: string;
  
  // Process Section
  processStep1Image: string;
  processStep2Image: string;
  processStep3Image: string;
  processStep4Image: string;
  
  // Testimonials
  testimonialBackground: string;
  
  // Landing Page Images
  stormReportBackground: string;
}

export default function Admin() {
  const { toast } = useToast();
  const [currentProject, setCurrentProject] = useState<string>("project1");
  const [formData, setFormData] = useState<ProjectForm>({
    title: "",
    description: "",
    imageUrl: "",
    category: "",
    location: ""
  });

  // Store all 6 projects' data
  const [allProjects, setAllProjects] = useState<{[key: string]: ProjectForm}>({
    project1: { title: "", description: "", imageUrl: "", category: "", location: "" },
    project2: { title: "", description: "", imageUrl: "", category: "", location: "" },
    project3: { title: "", description: "", imageUrl: "", category: "", location: "" },
    project4: { title: "", description: "", imageUrl: "", category: "", location: "" },
    project5: { title: "", description: "", imageUrl: "", category: "", location: "" },
    project6: { title: "", description: "", imageUrl: "", category: "", location: "" }
  });
  const [duplicateWarnings, setDuplicateWarnings] = useState<{[key: string]: boolean}>({});

  const [websiteImages, setWebsiteImages] = useState<WebsiteImages>({
    heroBackground: "",
    residentialRoofingImage: "",
    roofRepairImage: "",
    roofInspectionImage: "",
    gutterServiceImage: "",
    stormDamageImage: "",
    paintingServiceImage: "",
    teamPhoto: "",
    visionImage: "",
    processStep1Image: "",
    processStep2Image: "",
    processStep3Image: "",
    processStep4Image: "",
    testimonialBackground: "",
    stormReportBackground: ""
  });

  const [imagePreview, setImagePreview] = useState<string>("");

  // Load images from API
  const { data: savedImages, isLoading } = useQuery({
    queryKey: ['/api/website-images'],
    staleTime: 1000 * 60 * 5 // 5 minutes
  });

  // Function to sync projects to API
  const syncProjectsToAPI = async (projects: any[]) => {
    if (projects.length === 0) return;
    
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projects }),
      });
      
      if (response.ok) {
        console.log('Projects synced to API successfully');
      }
    } catch (error) {
      console.log('Failed to sync projects to API:', error);
    }
  };

  // Load saved images when component mounts
  useEffect(() => {
    // First, always try to load from localStorage for immediate display
    const imageKeys = [
      'heroBackground', 'heroFeatureImage', 'residentialRoofingImage', 'roofRepairImage',
      'roofInspectionImage', 'gutterServiceImage', 'stormDamageImage',
      'paintingServiceImage', 'teamPhoto', 'visionImage', 'companyLogo',
      'processStep1Image', 'processStep2Image', 'processStep3Image',
      'processStep4Image', 'testimonialBackground', 'stormReportBackground'
    ];
    
    imageKeys.forEach(key => {
      const saved = localStorage.getItem(key);
      if (saved) {
        setWebsiteImages(prev => ({ ...prev, [key]: saved }));
      }
    });
    
    // Then update with API data if available
    if (savedImages?.success && savedImages?.images) {
      setWebsiteImages(prev => ({
        ...prev,
        ...savedImages.images
      }));
    }

    // Load all project data and sync to API
    const loadedProjects: any = {};
    Object.keys(allProjects).forEach(projectKey => {
      const saved = localStorage.getItem(`project_${projectKey}`);
      if (saved) {
        try {
          const projectData = JSON.parse(saved);
          loadedProjects[projectKey] = projectData;
          setAllProjects(prev => ({ ...prev, [projectKey]: projectData }));
        } catch (error) {
          console.log('Error loading project data:', projectKey);
        }
      }
    });

    // Sync loaded projects to API for cross-device access
    const projectArray = Object.entries(loadedProjects)
      .filter(([_, project]: [string, any]) => project.imageUrl !== "")
      .map(([_, project]: [string, any]) => ({
        image: project.imageUrl,
        title: project.title || 'Untitled Project',
        description: project.description || 'Custom project managed through admin panel',
        category: project.category || 'Admin Project',
        location: project.location || 'Edmond, OK'
      }));
    
    if (projectArray.length > 0) {
      syncProjectsToAPI(projectArray);
    }
  }, [savedImages]);

  // Update form data when current project changes
  useEffect(() => {
    setFormData(allProjects[currentProject]);
    setImagePreview(allProjects[currentProject].imageUrl);
  }, [currentProject, allProjects]);

  const categories = [
    "Residential",
    "Commercial", 
    "Storm Damage",
    "Gutter Services",
    "Roof Repair",
    "New Installation",
    "Emergency Repair"
  ];

  const handleInputChange = (field: keyof ProjectForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Update the current project in allProjects
    setAllProjects(prev => ({
      ...prev,
      [currentProject]: { ...prev[currentProject], [field]: value }
    }));
    
    // Update image preview when URL changes
    if (field === 'imageUrl') {
      setImagePreview(value);
      // Check for duplicates
      checkForDuplicates(value);
    }
  };

  const handleImageChange = (field: keyof WebsiteImages, value: string) => {
    setWebsiteImages(prev => ({ ...prev, [field]: value }));
  };

  // Check for duplicate project images
  const checkForDuplicates = (newUrl: string) => {
    if (!newUrl) {
      setDuplicateWarnings(prev => ({ ...prev, [currentProject]: false }));
      return;
    }

    const isDuplicate = Object.entries(allProjects).some(([projectKey, project]) => {
      return project.imageUrl === newUrl && projectKey !== currentProject;
    });
    
    setDuplicateWarnings(prev => ({ ...prev, [currentProject]: isDuplicate }));
  };

  const saveCurrentProject = async () => {
    // Check for duplicates
    const isDuplicate = duplicateWarnings[currentProject];
    if (isDuplicate) {
      toast({
        title: "Cannot Save - Duplicate Image",
        description: "This image is already used in another project. Please choose a different image.",
        variant: "destructive",
      });
      return;
    }

    // Save the current project
    localStorage.setItem(`project_${currentProject}`, JSON.stringify(formData));
    
    // Update the project gallery for the website
    const projectArray = Object.entries(allProjects)
      .filter(([_, project]) => project.imageUrl !== "")
      .map(([_, project], index) => ({
        image: project.imageUrl,
        title: project.title || `Project ${index + 1}`,
        description: project.description || `Custom project managed through admin panel`,
        category: project.category || "Admin Project",
        location: project.location || "Edmond, OK"
      }));

    // Save to localStorage first
    localStorage.setItem('adminProjects', JSON.stringify(projectArray));
    
    try {
      // Also save to backend API for cross-device consistency
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projects: projectArray }),
      });

      if (response.ok) {
        toast({
          title: "Project Saved!",
          description: `${currentProject.replace('project', 'Project ')} has been saved and is now live on your website.`,
        });
      } else {
        throw new Error('Failed to save to server');
      }
    } catch (error) {
      // Still show success if localStorage save worked
      toast({
        title: "Project Saved Locally!",
        description: `${currentProject.replace('project', 'Project ')} has been saved. Note: Server sync failed.`,
      });
    }
  };

  const handleSaveWebsiteImages = async () => {
    try {
      // Save to both backend API and localStorage for compatibility
      const response = await fetch('/api/website-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(websiteImages),
      });

      if (response.ok) {
        // Also save to localStorage as backup
        Object.entries(websiteImages).forEach(([key, value]) => {
          if (value) {
            localStorage.setItem(key, value);
          }
        });
        
        toast({
          title: "Website Images Updated!",
          description: "All your website images have been updated and are now live on your website!",
        });
      } else {
        throw new Error('Failed to update images');
      }
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Please try again or check your internet connection.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    saveCurrentProject();
  };

  const ImageUploadField = ({ 
    label, 
    field, 
    description, 
    currentValue 
  }: { 
    label: string; 
    field: keyof WebsiteImages; 
    description: string;
    currentValue: string;
  }) => (
    <div className="space-y-3">
      <Label className="text-sm font-medium">{label}</Label>
      <Input
        value={currentValue}
        onChange={(e) => handleImageChange(field, e.target.value)}
        placeholder="Paste Cloudinary URL here..."
        className="h-12"
      />
      <p className="text-xs text-gray-500">{description}</p>
      {currentValue && (
        <div className="border rounded-lg overflow-hidden">
          <img 
            src={currentValue} 
            alt={label} 
            className="w-full h-32 object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Sigma Roofing Website Manager</h1>
          <p className="text-gray-600">Control every image and project on your website from one place</p>
        </div>

        <Tabs defaultValue="images" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="images" className="flex items-center">
              <Image className="w-4 h-4 mr-2" />
              Website Images
            </TabsTrigger>
            <TabsTrigger value="projects" className="flex items-center">
              <Plus className="w-4 h-4 mr-2" />
              Project Gallery
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center">
              <Upload className="w-4 h-4 mr-2" />
              Photo Manager
            </TabsTrigger>
          </TabsList>

          {/* Website Images Tab */}
          <TabsContent value="images">
            <div className="grid gap-6">
              {/* Hero Section */}
              <Card>
                <CardHeader className="bg-emerald-600 text-white">
                  <CardTitle className="flex items-center">
                    <Home className="w-5 h-5 mr-2" />
                    Hero Section Images
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <ImageUploadField
                    label="Hero Background Image"
                    field="heroBackground"
                    description="Main background image for your homepage hero section"
                    currentValue={websiteImages.heroBackground}
                  />
                </CardContent>
              </Card>

              {/* Services Section */}
              <Card>
                <CardHeader className="bg-emerald-600 text-white">
                  <CardTitle className="flex items-center">
                    <Wrench className="w-5 h-5 mr-2" />
                    Service Images
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <ImageUploadField
                      label="Residential Roofing Image"
                      field="residentialRoofingImage"
                      description="Showcase your residential roofing installations"
                      currentValue={websiteImages.residentialRoofingImage}
                    />
                    <ImageUploadField
                      label="Roof Repair Image"
                      field="roofRepairImage"
                      description="Showcase your roof repair work"
                      currentValue={websiteImages.roofRepairImage}
                    />
                    <ImageUploadField
                      label="Roof Inspection Image"
                      field="roofInspectionImage"
                      description="Professional inspection process"
                      currentValue={websiteImages.roofInspectionImage}
                    />
                    <ImageUploadField
                      label="Gutter Service Image"
                      field="gutterServiceImage"
                      description="Gutter installation or repair work"
                      currentValue={websiteImages.gutterServiceImage}
                    />
                    <ImageUploadField
                      label="Storm Damage Image"
                      field="stormDamageImage"
                      description="Storm damage restoration work"
                      currentValue={websiteImages.stormDamageImage}
                    />
                    <ImageUploadField
                      label="Painting Service Image"
                      field="paintingServiceImage"
                      description="Professional painting services"
                      currentValue={websiteImages.paintingServiceImage}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* About & Team Section */}
              <Card>
                <CardHeader className="bg-emerald-600 text-white">
                  <CardTitle className="flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    About & Team Images
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <ImageUploadField
                      label="Our Values Image"
                      field="teamPhoto"
                      description="Image representing your company values and team"
                      currentValue={websiteImages.teamPhoto}
                    />
                    <ImageUploadField
                      label="Our Vision Image"
                      field="visionImage"
                      description="Image representing your company vision and goals"
                      currentValue={websiteImages.visionImage}
                    />
                  </div>

                </CardContent>
              </Card>

              {/* Process Section */}
              <Card>
                <CardHeader className="bg-emerald-600 text-white">
                  <CardTitle className="flex items-center">
                    <Award className="w-5 h-5 mr-2" />
                    Process & Background Images
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <ImageUploadField
                      label="Process Step 1 Image"
                      field="processStep1Image"
                      description="Initial consultation/inspection image"
                      currentValue={websiteImages.processStep1Image}
                    />
                    <ImageUploadField
                      label="Process Step 2 Image"
                      field="processStep2Image"
                      description="Planning/preparation image"
                      currentValue={websiteImages.processStep2Image}
                    />
                    <ImageUploadField
                      label="Process Step 3 Image"
                      field="processStep3Image"
                      description="Installation/work in progress"
                      currentValue={websiteImages.processStep3Image}
                    />
                    <ImageUploadField
                      label="Process Step 4 Image"
                      field="processStep4Image"
                      description="Completion/quality check"
                      currentValue={websiteImages.processStep4Image}
                    />
                  </div>
                  <ImageUploadField
                    label="Testimonials Background"
                    field="testimonialBackground"
                    description="Background image for customer testimonials section"
                    currentValue={websiteImages.testimonialBackground}
                  />
                </CardContent>
              </Card>

              {/* Landing Page Images Section */}
              <Card>
                <CardHeader className="bg-emerald-600 text-white">
                  <CardTitle className="flex items-center">
                    <Image className="w-5 h-5 mr-2" />
                    Landing Page Images
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <ImageUploadField
                    label="Storm Report Background Image"
                    field="stormReportBackground"
                    description="Background image for the Recent Storm Report section on the hail damage landing page"
                    currentValue={websiteImages.stormReportBackground}
                  />
                </CardContent>
              </Card>

              {/* Save Button */}
              <div className="flex justify-center">
                <Button
                  onClick={handleSaveWebsiteImages}
                  className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-semibold"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  Update All Website Images
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects">
            <Card className="shadow-lg">
              <CardHeader className="bg-emerald-600 text-white">
                <CardTitle className="flex items-center">
                  <Plus className="w-5 h-5 mr-2" />
                  Project Gallery (6 Slots)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <div className="space-y-6">
                  {/* Project Selector */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center">
                      <Plus className="w-4 h-4 mr-2" />
                      Select Project to Edit
                    </Label>
                    <Select value={currentProject} onValueChange={setCurrentProject}>
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Choose which project to edit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="project1">Project 1</SelectItem>
                        <SelectItem value="project2">Project 2</SelectItem>
                        <SelectItem value="project3">Project 3</SelectItem>
                        <SelectItem value="project4">Project 4</SelectItem>
                        <SelectItem value="project5">Project 5</SelectItem>
                        <SelectItem value="project6">Project 6</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      Editing: {currentProject.replace('project', 'Project ')} - Changes will save to this slot
                    </p>
                  </div>

                  {/* Image URL Input */}
                  <div className="space-y-2">
                    <Label htmlFor="imageUrl" className="text-sm font-medium">
                      <Upload className="w-4 h-4 inline mr-2" />
                      Image URL *
                    </Label>
                    <Input
                      id="imageUrl"
                      value={formData.imageUrl}
                      onChange={(e) => handleInputChange('imageUrl', e.target.value)}
                      placeholder="Paste Cloudinary URL from Photo Manager tab"
                      className={`h-12 ${duplicateWarnings[currentProject] ? 'border-red-500' : ''}`}
                    />
                    {duplicateWarnings[currentProject] && (
                      <p className="text-red-500 text-xs">⚠️ This image is already used in another project. Please choose a different image.</p>
                    )}
                    <p className="text-xs text-gray-500">
                      Upload photos using the Photo Manager tab, then paste the URL here
                    </p>
                  </div>

                  {/* Image Preview */}
                  {imagePreview && !duplicateWarnings[currentProject] && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center">
                        <Eye className="w-4 h-4 mr-2" />
                        Preview
                      </Label>
                      <div className="border rounded-lg overflow-hidden">
                        <img 
                          src={imagePreview} 
                          alt="Preview" 
                          className="w-full h-48 object-cover"
                          onError={() => setImagePreview("")}
                        />
                      </div>
                    </div>
                  )}

                  {/* Project Details */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="title" className="text-sm font-medium">
                        Project Title *
                      </Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => handleInputChange('title', e.target.value)}
                        placeholder="e.g., Modern Family Home Roof Replacement"
                        className="h-12"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="location" className="text-sm font-medium">
                        Location
                      </Label>
                      <Input
                        id="location"
                        value={formData.location}
                        onChange={(e) => handleInputChange('location', e.target.value)}
                        placeholder="e.g., Edmond, OK"
                        className="h-12"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Project Category *</Label>
                    <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Select project category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-sm font-medium">
                      Project Description *
                    </Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="Describe the project details, materials used, challenges overcome, etc."
                      rows={4}
                    />
                  </div>

                  {/* Save Button */}
                  <div className="pt-4">
                    <Button
                      onClick={saveCurrentProject}
                      className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-semibold"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Save {currentProject.replace('project', 'Project ')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Photo Manager Tab */}
          <TabsContent value="upload">
            <CloudinaryPhotoManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}