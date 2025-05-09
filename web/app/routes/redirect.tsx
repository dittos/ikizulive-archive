import { useNavigate } from "react-router";
import { DEFAULT_LOCALE } from "~/i18n";
import { useEffect } from "react";

export default function Redirect() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate(`/${DEFAULT_LOCALE}`);
  }, [navigate]);

  return <div>Redirecting...</div>;
}
