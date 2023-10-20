import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { QrCode } from "lucide-react";

const Settings = () => {
  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <Card className="w-[400px] h-[500px] flex flex-col">
        <CardHeader className="flex justify-center items-center">
          <CardTitle>otp settings</CardTitle>
          {/* <CardDescription>This the setting </CardDescription> */}
        </CardHeader>
        <CardContent className="border grow">
          <p>Card Content</p>
        </CardContent>
        <CardFooter>
          <p>Card Footer</p>
        </CardFooter>
      </Card>
      <QrCode size={200} />
    </div>
  );
};

export default Settings;
