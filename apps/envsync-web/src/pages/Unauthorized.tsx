import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const UnauthorizedPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#0a0f1a]">
      <Card className="max-w-md w-full bg-gray-900 border-gray-800">
        <CardContent className="pt-8 pb-6 px-6">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
              <ShieldAlert className="text-red-400 size-8" />
            </div>

            <h1 className="text-xl font-semibold text-gray-100 mb-2">
              Access Denied
            </h1>

            <p className="text-sm text-gray-400 mb-6">
              You don't have permission to access this page. This area requires
              additional privileges that aren't associated with your account.
            </p>

            <Button
              onClick={() => navigate("/")}
              className="bg-violet-500 hover:bg-violet-600 text-white w-full"
            >
              <ArrowLeft className="size-4 mr-2" />
              Return to Dashboard
            </Button>

            <p className="text-gray-500 text-xs mt-6">
              If you believe this is an error, please contact your administrator.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UnauthorizedPage;
