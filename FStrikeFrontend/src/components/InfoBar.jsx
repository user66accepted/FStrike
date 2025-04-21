import React from "react";

export default function InfoBar({text=""}) {
    return (
      <div className="border border-sky-200 bg-sky-100 text-sky-700 p-4 rounded-md">
        No {text} created yet. Let's create one!
      </div>
    );
  }
  