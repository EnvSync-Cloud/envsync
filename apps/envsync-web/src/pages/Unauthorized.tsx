import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert, ArrowLeft, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const UnauthorizedPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gray-900">
      <Card className="max-w-md w-full bg-gray-800 border-gray-700">
        <CardContent className="pt-8 pb-6 px-6">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
              <ShieldAlert className="text-red-400 size-8" />
            </div>

            <h1 className="text-2xl font-bold text-white mb-2">
              Access Denied
            </h1>

            <p className="text-gray-400 mb-6">
              You don't have permission to access this page. This area requires
              additional privileges that aren't associated with your account.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <Button
                variant="outline"
                className="border-gray-600 text-white hover:bg-gray-700 w-full"
                asChild
              >
                <Button
                  onClick={() => navigate("/")}
                  className="flex items-center justify-center"
                >
                  <ArrowLeft className="size-4 mr-2" />
                  Go Back
                </Button>
              </Button>
            </div>

            <p className="text-gray-500 text-sm mt-6">
              If you believe this is an error, please contact your administrator
              for assistance.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UnauthorizedPage;
