import { useNavigate } from "react-router";
import { DEFAULT_LOCALE } from "~/i18n";
import { useEffect } from "react";

export default function Redirect() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate(`/${DEFAULT_LOCALE}`);
  }, [navigate]);

  return <div className="p-10 text-center text-gray-400">Redirecting...</div>;
}
