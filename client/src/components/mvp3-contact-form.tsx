import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, Mail, MapPin, Send, Calendar, ShieldCheck, AlertTriangle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Add script to head for Calendly
declare global {
  interface Window {
    Calendly: any;
  }
}

interface ContactForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  serviceType: string;
}

interface ValidationState {
  email: { valid: boolean; message: string };
  phone: { valid: boolean; message: string };
  address: { valid: boolean; message: string };
}

interface AddressSuggestion {
  formatted_address: string;
  place_id: string;
}

export default function MVP3ContactForm() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<ContactForm>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    serviceType: ""
  });

  const [validation, setValidation] = useState<ValidationState>({
    email: { valid: false, message: "" },
    phone: { valid: false, message: "" },
    address: { valid: false, message: "" }
  });

  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [addressSelected, setAddressSelected] = useState(false);
  const addressTimeoutRef = useRef<NodeJS.Timeout>();

  // Load Calendly widget script
  useEffect(() => {
    if (!document.querySelector('script[src*="calendly.com"]')) {
      const script = document.createElement('script');
      script.src = 'https://assets.calendly.com/assets/external/widget.js';
      script.async = true;
      script.type = 'text/javascript';
      document.head.appendChild(script);
    }
  }, []);

  // Email validation
  function validateEmail(email: string): { valid: boolean; message: string } {
    if (!email) return { valid: false, message: "" };
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(email)) {
      return { valid: false, message: "Please enter a valid email address" };
    }
    
    const fakeDomains = ['test.com', 'example.com', 'fake.com', 'temp.com'];
    const domain = email.split('@')[1]?.toLowerCase();
    if (fakeDomains.some(fake => domain?.includes(fake))) {
      return { valid: false, message: "Please use a real email address" };
    }
    
    return { valid: true, message: "✓ Valid email address" };
  }

  // Phone validation
  function validatePhone(phone: string): { valid: boolean; message: string } {
    if (!phone) return { valid: false, message: "" };
    
    const cleanPhone = phone.replace(/\D/g, '');
    
    if (cleanPhone.length < 10) {
      return { valid: false, message: "Phone number must be at least 10 digits" };
    }
    
    if (cleanPhone.length > 11) {
      return { valid: false, message: "Phone number too long" };
    }
    
    const phoneNumber = cleanPhone.length === 11 ? cleanPhone.slice(1) : cleanPhone;
    
    if (phoneNumber[0] === '0' || phoneNumber[0] === '1') {
      return { valid: false, message: "Invalid area code" };
    }
    
    if (phoneNumber[3] === '0' || phoneNumber[3] === '1') {
      return { valid: false, message: "Invalid phone number format" };
    }
    
    if (/^(\d)\1{9}$/.test(phoneNumber)) {
      return { valid: false, message: "Please enter a real phone number" };
    }
    
    return { valid: true, message: "✓ Valid phone number" };
  }

  // Format phone number
  function formatPhoneNumber(value: string): string {
    const phone = value.replace(/\D/g, '');
    if (phone.length <= 3) return phone;
    if (phone.length <= 6) return `(${phone.slice(0, 3)}) ${phone.slice(3)}`;
    return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6, 10)}`;
  }

  // Address validation
  function validateAddress(address: string, isSelected: boolean): { valid: boolean; message: string } {
    if (!address) return { valid: false, message: "" };
    
    if (!isSelected && address.length > 0) {
      return { valid: false, message: "Please select an address from the dropdown" };
    }
    
    if (isSelected) {
      return { valid: true, message: "✓ Valid Oklahoma address selected" };
    }
    
    return { valid: false, message: "" };
  }

  // Address autocomplete with debouncing
  const searchAddresses = (value: string) => {
    // Clear previous timeout
    if (addressTimeoutRef.current) {
      clearTimeout(addressTimeoutRef.current);
    }
    
    if (value.length < 1) {
      setShowSuggestions(false);
      setAddressSuggestions([]);
      return;
    }
    
    // Show suggestions immediately while searching
    if (!addressSelected) {
      setShowSuggestions(true);
    }
    
    // Set new timeout for debouncing
    addressTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/address-suggestions?q=${encodeURIComponent(value)}`);
        const data = await response.json();
        
        if (data.success && data.suggestions?.length > 0) {
          setAddressSuggestions(data.suggestions);
          setShowSuggestions(true);
        } else {
          setAddressSuggestions([]);
          // Keep showing empty state if user is typing
          if (value.length > 0 && !addressSelected) {
            setShowSuggestions(true);
          }
        }
      } catch (error) {
        console.error('Address search error:', error);
        setAddressSuggestions([]);
      }
    }, 300);
  };

  function selectAddress(suggestion: AddressSuggestion) {
    setFormData(prev => ({ ...prev, address: suggestion.formatted_address }));
    setShowSuggestions(false);
    setAddressSelected(true);
    setValidation(prev => ({ ...prev, address: validateAddress(suggestion.formatted_address, true) }));
  }

  // Update form data and validation
  const handleInputChange = (field: keyof ContactForm, value: string) => {
    let processedValue = value;
    
    if (field === 'phone') {
      processedValue = formatPhoneNumber(value);
    }
    
    setFormData(prev => ({ ...prev, [field]: processedValue }));
    
    // Update validation
    if (field === 'email') {
      setValidation(prev => ({ ...prev, email: validateEmail(processedValue) }));
    } else if (field === 'phone') {
      setValidation(prev => ({ ...prev, phone: validatePhone(processedValue) }));
    } else if (field === 'address') {
      setAddressSelected(false); // Reset selection when user types
      setValidation(prev => ({ ...prev, address: validateAddress(processedValue, false) }));
      searchAddresses(processedValue);
    }
  };

  // Form submission
  const contactMutation = useMutation({
    mutationFn: async (data: ContactForm) => {
      const response = await apiRequest("POST", "/api/contact", data);
      return response.json();
    },
    onSuccess: (data) => {
      setSuccessMessage(data.message || "Thank you! We'll contact you within 24 hours.");
      
      // Store data for Calendly
      const calendlyData = { 
        firstName: formData.firstName, 
        lastName: formData.lastName, 
        email: formData.email, 
        phone: formData.phone, 
        address: formData.address, 
        serviceType: formData.serviceType 
      };
      
      // Reset form
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        address: "",
        serviceType: ""
      });
      
      // Open Calendly popup
      setTimeout(() => {
        if (window.Calendly) {
          window.Calendly.initPopupWidget({
            url: 'https://calendly.com/aescalante-oksigma/new-meeting',
            prefill: {
              name: `${calendlyData.firstName} ${calendlyData.lastName}`,
              email: calendlyData.email,
              customAnswers: {
                a1: `Phone: ${calendlyData.phone} | Service: ${calendlyData.serviceType} | Address: ${calendlyData.address}`
              }
            }
          });
        }
      }, 1500);
    },
    onError: (error) => {
      toast({
        title: "Submission Failed",
        description: "Please check your information and try again.",
        variant: "destructive",
      });
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone || !formData.address || !formData.serviceType) {
      alert('Please fill in all required fields.');
      return;
    }
    
    if (!validation.email.valid) {
      alert('Please enter a valid email address.');
      return;
    }
    
    if (!validation.phone.valid) {
      alert('Please enter a valid phone number.');
      return;
    }
    
    if (!addressSelected || !validation.address.valid) {
      alert('Please select a valid address from the dropdown suggestions.');
      return;
    }
    
    setIsSubmitting(true);
    contactMutation.mutate(formData);
    setIsSubmitting(false);
  }

  return (
    <section id="contact" className="py-24 bg-gradient-to-br from-slate-50 to-white">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            🏠 Sigma Roofing LLC - MVP3
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Professional Roofing Services in Oklahoma
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <Card className="shadow-xl">
            <CardContent className="p-8">
              <h3 className="text-2xl font-semibold mb-2">Get Your Free Estimate</h3>
              <p className="text-gray-600 mb-6">
                Fill out our streamlined form and we'll contact you within 24 hours to schedule your consultation.
              </p>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Name fields */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                      placeholder="First Name*"
                      required
                      className="h-12"
                    />
                  </div>
                  <div>
                    <Input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                      placeholder="Last Name*"
                      required
                      className="h-12"
                    />
                  </div>
                </div>

                {/* Email field */}
                <div>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="Email Address*"
                    required
                    className={`h-12 ${validation.email.valid && formData.email ? 'border-green-500' : formData.email && !validation.email.valid ? 'border-red-500' : ''}`}
                  />
                  {formData.email && validation.email.message && (
                    <div className={`text-sm mt-1 ${validation.email.valid ? 'text-green-600' : 'text-red-500'}`}>
                      {validation.email.message}
                    </div>
                  )}
                </div>

                {/* Phone field */}
                <div>
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="Phone Number (e.g., 405-555-0123)*"
                    required
                    className={`h-12 ${validation.phone.valid && formData.phone ? 'border-green-500' : formData.phone && !validation.phone.valid ? 'border-red-500' : ''}`}
                  />
                  {formData.phone && validation.phone.message && (
                    <div className={`text-sm mt-1 ${validation.phone.valid ? 'text-green-600' : 'text-red-500'}`}>
                      {validation.phone.message}
                    </div>
                  )}
                </div>

                {/* Address field */}
                <div className="relative">
                  <Input
                    type="text"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    onBlur={() => {
                      // Delay to allow clicking on suggestions
                      setTimeout(() => setShowSuggestions(false), 200);
                    }}
                    placeholder="Start typing address - Select from dropdown*"
                    required
                    className={`h-12 ${validation.address.valid && formData.address ? 'border-green-500' : formData.address && !validation.address.valid ? 'border-red-500' : ''}`}
                    autoComplete="off"
                  />
                  {formData.address && validation.address.message && (
                    <div className={`text-sm mt-1 ${validation.address.valid ? 'text-green-600' : 'text-red-500'}`}>
                      {validation.address.message}
                    </div>
                  )}
                  {formData.address && !addressSelected && addressSuggestions.length === 0 && (
                    <div className="text-sm mt-1 text-amber-600">
                      Searching for Oklahoma addresses...
                    </div>
                  )}
                  {showSuggestions && (
                    <div className="absolute z-50 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto mt-1">
                      {addressSuggestions.length > 0 ? (
                        addressSuggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            type="button"
                            className="w-full text-left px-4 py-3 hover:bg-gray-100 border-b last:border-b-0"
                            onClick={() => selectAddress(suggestion)}
                          >
                            {suggestion.formatted_address}
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-gray-500 text-center">
                          {formData.address.length < 3 
                            ? "Keep typing to search for Oklahoma addresses..." 
                            : "No Oklahoma addresses found. Please check your spelling."}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Service type */}
                <Select value={formData.serviceType} onValueChange={(value) => handleInputChange('serviceType', value)}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select Service Type*" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="roof-repair">Roof Repair</SelectItem>
                    <SelectItem value="storm-damage">Storm Damage Assessment</SelectItem>
                    <SelectItem value="emergency-repair">Emergency Repair</SelectItem>
                    <SelectItem value="roof-replacement">Roof Replacement</SelectItem>
                    <SelectItem value="inspection">Roof Inspection</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Free Estimate Request'}
                </Button>
              </form>

              {successMessage && (
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800 flex items-center">
                    <ShieldCheck className="w-5 h-5 mr-2" />
                    {successMessage}
                  </p>
                </div>
              )}

              <div className="mt-8 bg-gradient-to-br from-red-600 to-red-700 text-white text-center p-8 rounded-lg">
                <h3 className="text-2xl font-bold mb-2">Emergency Storm Damage?</h3>
                <p className="mb-4">Call us now for immediate help:</p>
                <Button
                  type="button"
                  onClick={() => window.location.href='tel:+14059021826'}
                  className="bg-white text-red-600 hover:bg-gray-100 font-bold px-8 py-3"
                >
                  📞 (405) 902-1826
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}